const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { encryptArchive, decryptArchive } = require("../dr/neon-backup");

const ENV_FILES = Object.freeze(["apps/api/.env", "apps/api/.env.runtime"]);
const KEY_NAMES = Object.freeze([
  "PII_ENCRYPTION_KEY",
  "AADHAAR_ENCRYPTION_KEY",
  "PII_ENCRYPTION_KEY_PREV",
  "AADHAAR_ENCRYPTION_KEY_PREV",
  "MFA_RECOVERY_CODE_PEPPER",
  "MFA_RECOVERY_CODE_PEPPER_PREV",
]);
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

function encryptionEnvironment(text, secrets) {
  const found = new Set();
  const lines = text.split(/\r?\n/).filter((line) => {
    const name = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/.exec(line)?.[1];
    if (!KEY_NAMES.includes(name)) return true;
    if (found.has(name)) throw new Error("Duplicate encryption configuration");
    found.add(name);
    return false;
  });
  while (lines.at(-1) === "") lines.pop();
  return (
    lines.join("\n") +
    "\n\n# Coordinated encryption cutover; do not rotate independently of database ciphertext.\n" +
    Object.entries(secrets)
      .map(([name, value]) => {
        if (!KEY_NAMES.includes(name) || !value || /[\r\n]/.test(value))
          throw new Error("Unsupported encryption configuration");
        return `${name}=${JSON.stringify(value)}`;
      })
      .join("\n") +
    "\n"
  );
}

function writeDurable(filename, data) {
  const handle = fs.openSync(filename, "wx", 0o600);
  try {
    if (process.platform === "win32") {
      const identity = spawnSync("whoami", ["/user", "/fo", "csv", "/nh"], {
        encoding: "utf8",
        windowsHide: true,
      });
      const sid = identity.stdout?.match(/S-1-\d+(?:-\d+)+/)?.[0];
      if (identity.status !== 0 || !sid)
        throw new Error("Cannot identify configuration custodian");
      const acl = spawnSync(
        "icacls",
        [filename, "/inheritance:r", "/grant:r", `*${sid}:F`],
        { encoding: "utf8", windowsHide: true },
      );
      if (acl.status !== 0)
        throw new Error("Cannot protect configuration file");
    }
    // On Windows apply the DACL while the file is still empty, not after
    // writing secrets. POSIX uses the 0600 mode supplied to open().
    fs.writeFileSync(handle, data);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function atomicReplace(filename, text, expectedHash) {
  if (sha256(fs.readFileSync(filename)) !== expectedHash)
    throw new Error(
      "Active configuration changed; automatic replacement refused",
    );
  const temporary = `${filename}.cutover-${crypto.randomBytes(8).toString("hex")}`;
  writeDurable(temporary, text);
  // Recheck immediately before renaming. APIs must remain stopped/fenced.
  if (sha256(fs.readFileSync(filename)) !== expectedHash)
    throw new Error(
      "Concurrent configuration change; retain the private staged file for inspection",
    );
  fs.renameSync(temporary, filename);
  assert.equal(sha256(fs.readFileSync(filename)), sha256(text));
}

function saveCheckpoint(filename, value, key) {
  const plain = Buffer.from(JSON.stringify(value));
  let verified;
  try {
    writeDurable(filename, encryptArchive(plain, key));
    verified = decryptArchive(fs.readFileSync(filename), key);
    assert.ok(crypto.timingSafeEqual(plain, verified));
  } finally {
    plain.fill(0);
    if (verified) verified.fill(0);
  }
}

function readCheckpoint(filename, key) {
  const plain = decryptArchive(fs.readFileSync(filename), key);
  try {
    return JSON.parse(plain.toString("utf8"));
  } finally {
    plain.fill(0);
  }
}

function recoveryCopy(archivePath, manifest, receipt) {
  const archive = fs.readFileSync(archivePath);
  const archiveHash = sha256(archive);
  assert.equal(manifest.sha256, archiveHash);
  assert.equal(receipt.archive, path.basename(archivePath));
  assert.equal(receipt.archiveSha256, archiveHash);
  assert.equal(
    receipt.manifestSha256,
    sha256(fs.readFileSync(archivePath + ".json")),
  );
  assert.equal(receipt.independentHostCopy, true);
  assert.equal(receipt.remoteChecksumsMatchLocal, true);
  assert.equal(receipt.backupDecryptionKeyUploaded, false);
  assert.equal(receipt.directoryMode, "0700");
  assert.equal(receipt.fileMode, "0600");
  assert.equal(receipt.destinationHost, "school-erp-staging");
  assert.equal(
    receipt.destinationDirectory,
    "/home/ytech578/school-erp-secrets/recovery",
  );
  assert.ok(Number.isFinite(Date.parse(receipt.verifiedAt)));
  return archiveHash;
}

function privateState(root, filename) {
  const full = fs.realpathSync(path.resolve(root, filename));
  const relative = path
    .relative(fs.realpathSync(root), full)
    .split(path.sep)
    .join("/");
  if (
    !/^backups\/security-migration\/\d{13}-[a-f0-9]{12}\/cutover\.json$/.test(
      relative,
    )
  )
    throw new Error("Select an explicit private cutover state file");
  return full;
}

function configurationStatus(original, next, current) {
  if (sha256(current) === sha256(original)) return "original";
  if (sha256(current) === sha256(next)) return "next";
  throw new Error(
    "Unrecognized active configuration; preserve maintenance and inspect",
  );
}

function cloudRuntime(source, secrets) {
  assert.equal(new URL(source.DATABASE_URL).pathname, "/school_erp");
  assert.equal(
    decodeURIComponent(new URL(source.DATABASE_URL).username),
    "school_erp_runtime",
  );
  for (const name of Object.keys(secrets))
    if (!KEY_NAMES.includes(name))
      throw new Error("Unapproved cloud secret export");
  const result = {
    NODE_ENV: "production",
    APP_RUNTIME_ENV_ONLY: "true",
    ERP_DEPLOYMENT_MODE: "cloud",
    DATABASE_URL: source.DATABASE_URL,
    DATABASE_RLS_ENABLED: "true",
    JWT_ACCESS_SECRET: source.JWT_ACCESS_SECRET.trim(),
    JWT_REFRESH_SECRET: source.JWT_REFRESH_SECRET.trim(),
    ...secrets,
    ERP_DOMAIN: "staging.agenticschoolos.in",
    AUTHENTIK_DOMAIN: "auth-staging.agenticschoolos.in",
    ORIGIN_TLS_DIRECTORY: "/home/ytech578/school-erp-secrets/tls",
    TLS_READER_UID: "1001",
    TLS_READER_GID: "1002",
    REDIS_PASSWORD: crypto.randomBytes(32).toString("hex"),
    AUTHENTIK_PG_PASSWORD: crypto.randomBytes(32).toString("hex"),
    AUTHENTIK_SECRET_KEY: crypto.randomBytes(48).toString("hex"),
    API_PREFIX: "api",
    STORAGE_DRIVER: "s3",
    MALWARE_SCAN_REQUIRED: "true",
    BREAK_GLASS_REQUIRED: "true",
  };
  for (const name of [
    "NEON_DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "BACKUP_ENCRYPTION_KEY",
    "DEMO_PASSWORD",
    "GEMINI_API_KEY",
  ])
    assert.equal(result[name], undefined);
  return (
    Object.entries(result)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join("\n") + "\n"
  );
}

module.exports = {
  ENV_FILES,
  KEY_NAMES,
  sha256,
  encryptionEnvironment,
  writeDurable,
  atomicReplace,
  saveCheckpoint,
  readCheckpoint,
  recoveryCopy,
  privateState,
  configurationStatus,
  cloudRuntime,
};
