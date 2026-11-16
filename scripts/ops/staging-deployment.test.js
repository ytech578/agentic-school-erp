const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const env = {
  ...process.env,
  DB_USER: "",
  DB_PASSWORD: "",
  DB_NAME: "",
  DB_RUNTIME_USER: "",
  DB_RUNTIME_PASSWORD: "",
  DATABASE_URL:
    "postgresql://runtime:synthetic@ep-test-pooler.example.neon.tech/school_erp?sslmode=require",
  S3_BUCKET_NAME: "synthetic-private-bucket",
  S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  S3_REGION: "auto",
  S3_ACCESS_KEY_ID: "synthetic-access-key",
  S3_SECRET_ACCESS_KEY: "synthetic-secret",
  REDIS_PASSWORD: "synthetic-cache",
  PII_ENCRYPTION_KEY: "a".repeat(64),
  MFA_RECOVERY_CODE_PEPPER: "b".repeat(64),
  MFA_RECOVERY_CODE_PEPPER_PREV: "c".repeat(64),
  JWT_ACCESS_SECRET: "d".repeat(64),
  JWT_REFRESH_SECRET: "e".repeat(64),
  AUTHENTIK_PG_PASSWORD: "synthetic-identity-db",
  AUTHENTIK_SECRET_KEY: "f".repeat(64),
  ERP_DOMAIN: "staging.example.invalid",
  AUTHENTIK_DOMAIN: "auth-staging.example.invalid",
  AUTHENTIK_PUBLIC_ENABLED: "0",
  TLS_READER_UID: "1000",
  TLS_READER_GID: "1000",
  ORIGIN_TLS_DIRECTORY: "/synthetic-private-tls",
  COMPOSE_PROFILES: "",
};
const args = [
  "compose",
  "--env-file",
  ".env.example",
  "-f",
  "docker-compose.yml",
  "-f",
  "infrastructure/deploy/cloud.compose.yml",
  "-f",
  "infrastructure/authentik/compose.yml",
  "-f",
  "infrastructure/deploy/staging.compose.yml",
  "config",
  "--format",
  "json",
];
const available =
  spawnSync("docker", ["compose", "version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  }).status === 0;

test("container build context excludes school documents, recovery archives and private keys", () => {
  const patterns = fs
    .readFileSync(path.join(root, ".dockerignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim());
  for (const pattern of [
    "backups/",
    "**/uploads/",
    "nginx/ssl/",
    "**/*.pem",
    "**/*.key",
    "**/storage.env",
    "**/*secrets*.env",
  ])
    assert.ok(patterns.includes(pattern));
});

test(
  "staging compose exposes one shared TLS proxy and builds the correct API address",
  {
    skip:
      !available &&
      "Docker Compose is required for this configuration integration check",
  },
  () => {
    const result = spawnSync("docker", args, {
      cwd: root,
      env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 20000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(
      result.status,
      0,
      "Synthetic staging Compose configuration must compile",
    );
    const config = JSON.parse(result.stdout);
    assert.equal(config.name, "school-erp-staging");
    const { services } = config;
    const exposed = Object.entries(services)
      .filter(([, service]) => (service.ports || []).length)
      .map(([name]) => name);
    assert.deepEqual(exposed, ["nginx"]);
    assert.deepEqual(
      services.nginx.ports.map((port) => port.published).sort(),
      ["443", "80"],
    );
    assert.equal(
      services.web.build.args.NEXT_PUBLIC_API_URL,
      "https://staging.example.invalid/api/v1",
    );
    assert.equal(
      services.web.environment.INTERNAL_API_URL,
      "http://api:4000/api/v1",
    );
    assert.equal(services.api.environment.DATABASE_URL, env.DATABASE_URL);
    assert.equal(
      services.api.environment.MFA_RECOVERY_CODE_PEPPER_PREV,
      env.MFA_RECOVERY_CODE_PEPPER_PREV,
    );
    assert.equal(services.api.environment.NEON_DATABASE_URL, undefined);
    // Compose excludes services behind unselected profiles from the default plan.
    assert.equal(services.postgres, undefined);
    assert.equal(services.pgbouncer, undefined);
    assert.equal(services.server.ports?.length || 0, 0);
    assert.equal(Number(services["identity-db"].mem_limit), 768 * 1024 * 1024);
    assert.equal(Number(services["identity-db"].memswap_limit), 1536 * 1024 * 1024);
    assert.equal(services["identity-db"].ports?.length || 0, 0);
    assert.equal(services.nginx.read_only, true);
    assert.equal(services.nginx.user, "1000:1000");
    assert.equal(services.nginx.environment.AUTHENTIK_PUBLIC_ENABLED, "0");
    assert.equal(services.redis.command.at(-1), "noeviction");
  },
);

test("proxy preserves API paths and prevents raw document serving or callback query logging", () => {
  const config = fs.readFileSync(
    path.join(root, "infrastructure/deploy/staging-nginx.conf.template"),
    "utf8",
  );
  assert.match(config, /location \^~ \/api\/ \{/);
  assert.match(config, /location \^~ \/api\/sso\/ \{/);
  assert.ok(config.includes('rewrite ^/api/sso/(.*)$ /api/v1/sso/$1 last;'));
  assert.match(config, /proxy_pass http:\/\/erp_api;/);
  assert.doesNotMatch(config, /proxy_pass http:\/\/erp_api\//);
  assert.match(config, /location \^~ \/uploads\/ \{ return 404; \}/);
  assert.match(config, /access_log off;/);
  assert.match(config, /ssl_reject_handshake on;/);
  assert.match(config, /if \(\$identity_public_ready = 0\) \{ return 503; \}/);
  assert.match(config, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.match(config, /proxy_set_header X-Forwarded-Proto https;/);
});

test("proxy refreshes Docker service addresses after backend maintenance", () => {
  const config = fs.readFileSync(
    path.join(root, "infrastructure/deploy/staging-nginx.conf.template"),
    "utf8",
  );
  assert.match(config, /resolver 127\.0\.0\.11 valid=5s ipv6=off;/);
  assert.match(config, /resolver_timeout 2s;/);
  for (const [upstream, target] of [
    ["erp_web", "web:3000"],
    ["erp_api", "api:4000"],
    ["school_identity", "server:9000"],
  ]) {
    assert.ok(config.includes(`upstream ${upstream} {\n        zone ${upstream} 64k;\n        server ${target} resolve;`));
  }
});
