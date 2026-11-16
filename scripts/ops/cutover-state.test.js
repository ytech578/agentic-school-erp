const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const {
  encryptionEnvironment,
  configurationStatus,
  cloudRuntime,
  sha256,
  saveCheckpoint,
  readCheckpoint,
  atomicReplace,
  recoveryCopy,
} = require("./cutover-state");

test("encryption configuration preserves unrelated settings and removes old key aliases", () => {
  const before =
    "# retained comment\nJWT_ACCESS_SECRET=unchanged\nPII_ENCRYPTION_KEY=old\nPII_ENCRYPTION_KEY_PREV=older\nAADHAAR_ENCRYPTION_KEY=alias\n";
  const secrets = {
    PII_ENCRYPTION_KEY: "new",
    MFA_RECOVERY_CODE_PEPPER: "current",
    MFA_RECOVERY_CODE_PEPPER_PREV: "previous",
  };
  const after = encryptionEnvironment(before, secrets);
  assert.match(after, /# retained comment/);
  assert.deepEqual(dotenv.parse(after), {
    JWT_ACCESS_SECRET: "unchanged",
    ...secrets,
  });
  assert.throws(() =>
    encryptionEnvironment(
      "PII_ENCRYPTION_KEY=a\nPII_ENCRYPTION_KEY=b\n",
      secrets,
    ),
  );
  assert.throws(() =>
    encryptionEnvironment(before, { DATABASE_URL: "not permitted" }),
  );
  assert.throws(() =>
    encryptionEnvironment(before, { PII_ENCRYPTION_KEY: "bad\nvalue" }),
  );
});

test("configuration recovery refuses unknown content rather than guessing or overwriting", () => {
  assert.equal(configurationStatus("original", "next", "original"), "original");
  assert.equal(configurationStatus("original", "next", "next"), "next");
  assert.throws(() =>
    configurationStatus("original", "next", "someone-else-changed-this"),
  );
});

test("cloud runtime contains only deployment credentials, never owner/backup/development keys", () => {
  const source = {
    DATABASE_URL:
      "postgresql://school_erp_runtime:synthetic@ep-test.neon.tech/school_erp?sslmode=require",
    JWT_ACCESS_SECRET: "a".repeat(64),
    JWT_REFRESH_SECRET: "b".repeat(64),
    BACKUP_ENCRYPTION_KEY: "sensitive backup key",
    NEON_DATABASE_URL: "sensitive owner URL",
    GEMINI_API_KEY: "not authorized for this deployment",
  };
  const values = dotenv.parse(
    cloudRuntime(source, {
      PII_ENCRYPTION_KEY: "c".repeat(64),
      MFA_RECOVERY_CODE_PEPPER: "d".repeat(64),
      MFA_RECOVERY_CODE_PEPPER_PREV: "e".repeat(64),
    }),
  );
  assert.equal(values.DATABASE_URL, source.DATABASE_URL);
  assert.equal(values.NODE_ENV, "production");
  assert.equal(values.TLS_READER_UID, "1001");
  assert.equal(values.TLS_READER_GID, "1002");
  assert.match(values.AUTHENTIK_SECRET_KEY, /^[a-f0-9]{96}$/);
  assert.notEqual(values.REDIS_PASSWORD, values.AUTHENTIK_PG_PASSWORD);
  for (const name of [
    "NEON_DATABASE_URL",
    "BACKUP_ENCRYPTION_KEY",
    "GEMINI_API_KEY",
  ])
    assert.equal(values[name], undefined);
  assert.throws(() =>
    cloudRuntime(
      {
        ...source,
        DATABASE_URL: source.DATABASE_URL.replace(
          "school_erp_runtime:",
          "school_erp_owner:",
        ),
      },
      {},
    ),
  );
});

test("durable checkpoints authenticate all recovery content and atomic configuration rollback preserves exact original bytes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "erp-cutover-unit-"));
  const checkpoint = path.join(directory, "checkpoint.enc"),
    config = path.join(directory, "synthetic.env");
  const key = crypto.randomBytes(32),
    original = "SYNTHETIC=original\r\n",
    next = "SYNTHETIC=next\n";
  try {
    saveCheckpoint(checkpoint, { original, next, synthetic: true }, key);
    assert.deepEqual(readCheckpoint(checkpoint, key), {
      original,
      next,
      synthetic: true,
    });
    assert.equal(
      fs.readFileSync(checkpoint).includes(Buffer.from(original)),
      false,
    );
    assert.throws(() => readCheckpoint(checkpoint, crypto.randomBytes(32)));
    fs.writeFileSync(config, original);
    assert.throws(() => atomicReplace(config, next, "wrong hash"));
    assert.equal(fs.readFileSync(config, "utf8"), original);
    atomicReplace(config, next, sha256(original));
    atomicReplace(config, original, sha256(next));
    assert.equal(fs.readFileSync(config, "utf8"), original);
    assert.throws(() => saveCheckpoint(checkpoint, {}, key));
  } finally {
    // Exact files made by this test only, with no recursive removal.
    for (const filename of [checkpoint, config])
      if (fs.existsSync(filename)) fs.unlinkSync(filename);
    fs.rmdirSync(directory);
    key.fill(0);
  }
});

test("independent-copy gate requires both exact hashes, private permissions and a separately retained key", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "erp-copy-unit-"));
  const filename = path.join(directory, "synthetic.dump.enc");
  try {
    fs.writeFileSync(filename, "synthetic ciphertext");
    const manifest = { sha256: sha256("synthetic ciphertext") };
    fs.writeFileSync(filename + ".json", JSON.stringify(manifest));
    const receipt = {
      archive: path.basename(filename),
      archiveSha256: manifest.sha256,
      manifestSha256: sha256(fs.readFileSync(filename + ".json")),
      independentHostCopy: true,
      remoteChecksumsMatchLocal: true,
      backupDecryptionKeyUploaded: false,
      directoryMode: "0700",
      fileMode: "0600",
      destinationHost: "school-erp-staging",
      destinationDirectory: "/home/ytech578/school-erp-secrets/recovery",
      verifiedAt: new Date().toISOString(),
    };
    assert.equal(recoveryCopy(filename, manifest, receipt), manifest.sha256);
    for (const change of [
      { manifestSha256: "wrong" },
      { archiveSha256: "wrong" },
      { independentHostCopy: false },
      { backupDecryptionKeyUploaded: true },
      { fileMode: "0644" },
      { directoryMode: "0755" },
    ])
      assert.throws(() =>
        recoveryCopy(filename, manifest, { ...receipt, ...change }),
      );
  } finally {
    for (const filenameToRemove of [filename, filename + ".json"])
      if (fs.existsSync(filenameToRemove)) fs.unlinkSync(filenameToRemove);
    fs.rmdirSync(directory);
  }
});
