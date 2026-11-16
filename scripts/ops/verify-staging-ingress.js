#!/usr/bin/env node
/** Isolated local proxy acceptance: synthetic backends/certificates only. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");
const assert = require("node:assert/strict");
const { parseArgs } = require("node:util");
const { spawnSync } = require("node:child_process");
const { privateDirectory } = require("./migrate-encryption-local");
const root = path.resolve(__dirname, "../..");
const image =
  "nginx:alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d";
let operation = "configuration";

function command(binary, args) {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0 || result.error) {
    const error = new Error("Local ingress operation failed");
    error.code = result.error?.code || `EXIT_${result.status}`;
    error.diagnostic = {
      stdout: result.stdout?.slice(-2000) || "",
      stderr: result.stderr?.slice(-2000) || "",
    };
    throw error;
  }
  return result.stdout.trim();
}
function allowFixtureContainerRead(file) {
  // A root-operated Linux Docker check still runs containers as 1000:1000.
  // Transfer only this run's synthetic bind files; never make them world-readable.
  if (process.platform !== "win32" && process.getuid?.() === 0)
    fs.chownSync(file, 1000, 1000);
}
function request(port, hostname, url, ca) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        host: "127.0.0.1",
        port,
        servername: hostname,
        path: url,
        ca,
        headers: { Host: hostname },
        timeout: 3000,
        agent: false,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 2048)
            response.destroy(new Error("Unexpected fixture body"));
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body,
            headers: response.headers,
          }),
        );
        response.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Local ingress timed out")));
    req.on("error", reject);
  });
}

async function main() {
  const { values } = parseArgs({
    options: { openssl: { type: "string", default: "openssl" } },
  });
  // Require a pre-existing image: never silently pull/run a new image or start
  // the real ERP/Authentik just to validate proxy routing.
  operation = "inspect_existing_image";
  command("docker", ["image", "inspect", image]);
  const directory = privateDirectory();
  const cert = path.join(directory, "synthetic-fullchain.pem");
  const key = path.join(directory, "synthetic-privkey.pem");
  operation = "generate_synthetic_certificate";
  command(values.openssl, [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-keyout",
    key,
    "-out",
    cert,
    "-subj",
    "/CN=staging.example.invalid",
    "-addext",
    "subjectAltName=DNS:staging.example.invalid,DNS:auth-staging.example.invalid",
  ]);
  const template = fs.readFileSync(
    path.join(root, "infrastructure/deploy/staging-nginx.conf.template"),
    "utf8",
  );
  const renderConfig = (enabled) =>
    template
      .replaceAll("${ERP_DOMAIN}", "staging.example.invalid")
      .replaceAll("${AUTHENTIK_DOMAIN}", "auth-staging.example.invalid")
      .replaceAll("${AUTHENTIK_PUBLIC_ENABLED}", enabled ? "1" : "0");
  const config = renderConfig(false);
  fs.writeFileSync(path.join(directory, "nginx.conf"), config, {
    flag: "wx",
    mode: 0o600,
  });
  fs.writeFileSync(
    path.join(directory, "backend.conf"),
    `pid /tmp/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 64; }
http {
 access_log off;
 server { listen 3000; location / { return 200 'web-fixture'; } }
 server { listen 4000; location / { return 200 "$request_uri"; } }
 server { listen 9000; location / { return 200 'identity-fixture'; } }
}
`,
    { flag: "wx", mode: 0o600 },
  );
  for (const file of [cert, key, path.join(directory, "nginx.conf"), path.join(directory, "backend.conf")])
    allowFixtureContainerRead(file);
  const nonce = crypto.randomBytes(6).toString("hex");
  const network = `erp-ingress-check-${nonce}`;
  const backend = `${network}-backend`,
    proxy = `${network}-proxy`;
  let createdNetwork = false;
  const created = [];
  try {
    operation = "create_isolated_test_network";
    // A private-to-this-run bridge is needed for a loopback-published test port.
    // Docker's --internal network suppresses publishing on this installation.
    // All upstreams are synthetic; no school services join this network.
    command("docker", ["network", "create", network]);
    createdNetwork = true;
    const common = [
      "--read-only",
      "--user",
      "1000:1000",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges=true",
      "--memory",
      "64m",
      "--cpus",
      "0.25",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16m,mode=1777",
      "--tmpfs",
      "/var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777",
      "--network",
      network,
    ];
    operation = "start_synthetic_backend";
    command("docker", [
      "run",
      "-d",
      "--name",
      backend,
      ...common,
      "--network-alias",
      "web",
      "--network-alias",
      "api",
      "--network-alias",
      "server",
      "--mount",
      `type=bind,src=${path.join(directory, "backend.conf")},dst=/test.conf,readonly`,
      "--entrypoint",
      "nginx",
      image,
      "-c",
      "/test.conf",
      "-g",
      "daemon off;",
    ]);
    created.push(backend);
    operation = "start_test_proxy";
    command("docker", [
      "run",
      "-d",
      "--name",
      proxy,
      ...common,
      "-p",
      "127.0.0.1::8443",
      "--mount",
      `type=bind,src=${path.join(directory, "nginx.conf")},dst=/test.conf,readonly`,
      "--mount",
      `type=bind,src=${cert},dst=/tls/fullchain.pem,readonly`,
      "--mount",
      `type=bind,src=${key},dst=/tls/privkey.pem,readonly`,
      "--entrypoint",
      "nginx",
      image,
      "-c",
      "/test.conf",
      "-g",
      "daemon off;",
    ]);
    created.push(proxy);
    operation = "validate_running_proxy_syntax";
    command("docker", ["exec", proxy, "nginx", "-c", "/test.conf", "-t"]);
    operation = "discover_loopback_test_port";
    const binding = command("docker", ["port", proxy, "8443/tcp"]);
    assert.match(binding, /^127\.0\.0\.1:\d+$/);
    const port = Number(binding.split(":").at(-1)),
      ca = fs.readFileSync(cert);
    operation = "verify_tls_frontend_routing";
    let ready;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        ready = await request(port, "staging.example.invalid", "/login", ca);
        if (ready.status === 200 && ready.body === "web-fixture") break;
        if (attempt === 19) throw new Error("Synthetic frontend did not become ready");
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        if (attempt === 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.equal(ready.status, 200);
    assert.equal(ready.body, "web-fixture");
    operation = "verify_api_paths_and_cache_headers";
    for (const url of ["/api/v1/health", "/api/v1/documents/private.png"]) {
      const result = await request(port, "staging.example.invalid", url, ca);
      assert.equal(result.status, 200);
      assert.equal(result.body, url);
      assert.equal(result.headers["cache-control"], "private, no-store");
      assert.equal(
        result.headers["strict-transport-security"],
        "max-age=86400",
      );
      assert.equal(result.headers["x-content-type-options"], "nosniff");
    }
    operation = "verify_legacy_sso_prefix_preserves_query_and_security_headers";
    const legacySso = await request(
      port,
      "staging.example.invalid",
      "/api/sso/DEMO001/pilot/start?returnUrl=%2Fauth%2Fsso%2Fcallback",
      ca,
    );
    assert.equal(legacySso.status, 200);
    assert.equal(
      legacySso.body,
      "/api/v1/sso/DEMO001/pilot/start?returnUrl=%2Fauth%2Fsso%2Fcallback",
    );
    assert.equal(legacySso.headers["cache-control"], "private, no-store");
    assert.equal(legacySso.headers["x-content-type-options"], "nosniff");
    operation = "verify_upload_and_identity_routing";
    assert.equal(
      (
        await request(
          port,
          "staging.example.invalid",
          "/uploads/private.png",
          ca,
        )
      ).status,
      404,
    );
    const identityRequest = () =>
      request(
        port,
        "auth-staging.example.invalid",
        "/application/o/example/",
        ca,
      );
    assert.equal((await identityRequest()).status, 503);
    operation = "verify_explicit_identity_publication";
    fs.writeFileSync(path.join(directory, "nginx.conf"), renderConfig(true), {
      mode: 0o600,
    });
    command("docker", ["exec", proxy, "nginx", "-c", "/test.conf", "-t"]);
    command("docker", [
      "exec",
      proxy,
      "nginx",
      "-c",
      "/test.conf",
      "-s",
      "reload",
    ]);
    let identity;
    for (let attempt = 0; attempt < 20; attempt++) {
      identity = await identityRequest();
      if (identity.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(identity.status, 200);
    assert.equal(identity.body, "identity-fixture");
    operation = "verify_backend_address_change_without_proxy_reload";
    // Allocate the replacement while the original still owns its address,
    // guaranteeing a different address rather than a misleading same-IP restart.
    const replacement = `${network}-backend-next`;
    const replacementConfig = path.join(directory, "backend-next.conf");
    fs.writeFileSync(replacementConfig,
      fs.readFileSync(path.join(directory, "backend.conf"), "utf8")
        .replace("identity-fixture", "identity-fixture-next"),
      { flag: "wx", mode: 0o600 });
    allowFixtureContainerRead(replacementConfig);
    command("docker", [
      "run", "-d", "--name", replacement, ...common,
      "--network-alias", "web", "--network-alias", "api", "--network-alias", "server",
      "--mount", `type=bind,src=${replacementConfig},dst=/test.conf,readonly`,
      "--entrypoint", "nginx", image, "-c", "/test.conf", "-g", "daemon off;",
    ]);
    created.push(replacement);
    const address = (name) => JSON.parse(command("docker", ["inspect", name]))[0]
      .NetworkSettings.Networks[network].IPAddress;
    assert.notEqual(address(replacement), address(backend));
    command("docker", ["rm", "-f", backend]);
    created.splice(created.indexOf(backend), 1);
    let refreshed = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const result = await identityRequest();
        if (result.status === 200 && result.body === "identity-fixture-next") {
          refreshed = true; break;
        }
      } catch { /* DNS refresh may briefly overlap backend termination. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(refreshed, true, "Identity upstream must recover without proxy reload");
    assert.equal((await request(port, "staging.example.invalid", "/login", ca)).body, "web-fixture");
    assert.equal((await request(port, "staging.example.invalid", "/api/v1/health", ca)).body, "/api/v1/health");
    await assert.rejects(request(port, "unknown.example.invalid", "/", ca));
    const evidence = {
      checkedAt: new Date().toISOString(),
      localSyntheticOnly: true,
      nginxSyntaxValid: true,
      nonRootReadOnlyProxy: true,
      verifiedTlsWithoutBypass: true,
      inheritedSecurityHeadersVerified: true,
      frontendRouted: true,
      apiVersionPreserved: true,
      legacySsoPrefixAndQueryPreserved: true,
      apiImagePathNotRoutedToWeb: true,
      identityRouted: true,
      backendAddressChangeRecoveredWithoutProxyReload: true,
      unpublishedIdentityDeniedByDefault: true,
      rawUploadsDenied: true,
      unknownTlsNameDenied: true,
      liveServicesStarted: false,
      productionBrowserLoginTested: false,
    };
    const report = path.join(directory, "staging-ingress-verification.json");
    fs.writeFileSync(report, JSON.stringify(evidence, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    console.log(JSON.stringify({ ...evidence, report }, null, 2));
  } catch (error) {
    // Only synthetic fixture logs are retained; this harness never starts or
    // reads logs from real ERP, identity, database or existing containers.
    const diagnostics = created.map((name) => {
      const logs = spawnSync("docker", ["logs", "--tail", "30", name], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      });
      return { name, stdout: logs.stdout || "", stderr: logs.stderr || "" };
    });
    const report = path.join(directory, "synthetic-failure.json");
    fs.writeFileSync(
      report,
      JSON.stringify(
        { operation, command: error.diagnostic, diagnostics },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    console.error(JSON.stringify({ syntheticDiagnostic: report }));
    throw error;
  } finally {
    // Remove only this run's newly named synthetic containers/network. Keep
    // private artifacts for inspection; never stop existing ERP/identity stacks.
    const errors = [];
    for (const name of created.reverse()) {
      try {
        command("docker", ["rm", "-f", name]);
      } catch {
        errors.push(name);
      }
    }
    if (createdNetwork) {
      try {
        command("docker", ["network", "rm", network]);
      } catch {
        errors.push(network);
      }
    }
    if (errors.length)
      throw new Error(
        `Inspect retained synthetic ingress resources: ${errors.join(", ")}`,
      );
  }
}
module.exports = { request };
if (require.main === module)
  main().catch((error) => {
    console.error(
      "Synthetic local ingress verification failed. No live database, VM, application settings or existing containers were changed.",
    );
    console.error(
      JSON.stringify({
        operation,
        code: /^[A-Z0-9_]+$/.test(error.code || "")
          ? error.code
          : "CHECK_FAILED",
      }),
    );
    process.exitCode = 1;
  });
