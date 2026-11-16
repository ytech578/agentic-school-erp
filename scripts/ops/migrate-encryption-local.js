#!/usr/bin/env node
/** LOCAL RESTORE ONLY. There is intentionally no Neon/live migration mode. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseArgs } = require('node:util');
const { spawnSync } = require('node:child_process');
const {
  restoredTarget,
  keyFromValue,
  rotationSecrets,
  decryptField,
  migrateFields,
  invariantFingerprint,
  encryptedInventory,
  inventoryFingerprint,
  auditFingerprint,
  assertTargetDatabase,
} = require('./encryption-migration');

const root = path.resolve(__dirname, '../..');
const envFiles = ['apps/api/.env', 'apps/api/.env.runtime'];
const encryptionVariables = [
  'NODE_ENV',
  'PII_ENCRYPTION_KEY',
  'AADHAAR_ENCRYPTION_KEY',
  'PII_ENCRYPTION_KEY_PREV',
  'AADHAAR_ENCRYPTION_KEY_PREV',
];
let currentOperation = 'configuration';

function environmentFingerprint() {
  return Object.fromEntries(
    envFiles.map((name) => [
      name,
      fs.existsSync(path.join(root, name))
        ? crypto
            .createHash('sha256')
            .update(fs.readFileSync(path.join(root, name)))
            .digest('hex')
        : null,
    ]),
  );
}

function withEncryptionEnvironment(values, work) {
  const saved = Object.fromEntries(
    encryptionVariables.map((name) => [name, process.env[name]]),
  );
  const restore = () => {
    for (const name of encryptionVariables) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  };
  try {
    for (const name of encryptionVariables) {
      if (values[name] === undefined) delete process.env[name];
      else process.env[name] = values[name];
    }
    const result = work();
    if (result && typeof result.then === 'function')
      return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function restoreReport(filename) {
  if (!filename)
    throw new Error('Select an explicit successful restore report');
  const directory = fs.realpathSync(path.join(root, 'backups/neon'));
  if (
    path.relative(fs.realpathSync(root), directory) !==
    path.join('backups', 'neon')
  )
    throw new Error('Refusing a redirected restore-report directory');
  const selected = fs.realpathSync(path.resolve(root, filename));
  if (
    path.dirname(selected) !== directory ||
    !/^restore-drill-[a-f0-9]{12}\.json$/.test(path.basename(selected))
  )
    throw new Error('The report must be an existing report in backups/neon');
  return JSON.parse(fs.readFileSync(selected, 'utf8'));
}

function privateDirectory() {
  const backups = fs.realpathSync(path.join(root, 'backups'));
  if (path.relative(fs.realpathSync(root), backups) !== 'backups')
    throw new Error('Refusing a redirected backup directory');
  const parent = path.join(backups, 'security-migration');
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (fs.realpathSync(parent) !== parent)
    throw new Error('Refusing a redirected secrets directory');
  const directory = path.join(
    parent,
    `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
  );
  fs.mkdirSync(directory, { mode: 0o700 });
  // POSIX mode bits alone do not protect files on Windows. Remove inherited
  // permissions before creating any secrets, granting only the current user.
  if (process.platform === 'win32') {
    const identity = spawnSync('whoami', ['/user', '/fo', 'csv', '/nh'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const sid = identity.stdout?.match(/S-1-\d+(?:-\d+)+/)?.[0];
    if (identity.status !== 0 || !sid)
      throw new Error('Could not identify the secrets custodian');
    const acl = spawnSync(
      'icacls',
      [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`],
      { encoding: 'utf8', windowsHide: true },
    );
    if (acl.status !== 0)
      throw new Error('Could not secure the private secrets directory');
  }
  return directory;
}

function saveJournal(filename, journal, newKey) {
  const key = Buffer.from(
    crypto.hkdfSync(
      'sha256',
      newKey,
      Buffer.alloc(0),
      Buffer.from('erp-local-encryption-rehearsal-journal-v1'),
      32,
    ),
  );
  const plain = Buffer.from(JSON.stringify(journal));
  let verified;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    fs.writeFileSync(
      filename,
      Buffer.concat([
        Buffer.from('ERPLOCAL1'),
        iv,
        cipher.getAuthTag(),
        encrypted,
      ]),
      { flag: 'wx', mode: 0o600 },
    );
    const saved = fs.readFileSync(filename);
    assert.equal(saved.subarray(0, 9).toString(), 'ERPLOCAL1');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      saved.subarray(9, 21),
    );
    decipher.setAuthTag(saved.subarray(21, 37));
    verified = Buffer.concat([
      decipher.update(saved.subarray(37)),
      decipher.final(),
    ]);
    assert.ok(crypto.timingSafeEqual(plain, verified));
  } finally {
    key.fill(0);
    plain.fill(0);
    if (verified) verified.fill(0);
  }
}

// Independent test-code generator: actual MFA seeds/codes never leave memory.
function testTotp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0,
    value = 0;
  const bytes = [];
  for (const character of secret.toUpperCase().replace(/=+$/, '')) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid restored TOTP secret');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const key = Buffer.from(bytes);
  try {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const digest = crypto.createHmac('sha1', key).update(counter).digest();
    const offset = digest[digest.length - 1] & 15;
    return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
      .toString()
      .padStart(6, '0');
  } finally {
    key.fill(0);
    bytes.fill(0);
  }
}

class ExpectedRollback extends Error {}

async function snapshot(client, database) {
  return client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await assertTargetDatabase(tx, database);
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      return {
        business: await invariantFingerprint(tx),
        encrypted: inventoryFingerprint(await encryptedInventory(tx)),
        audit: await auditFingerprint(tx),
        users: await tx.user.count(),
        mfaEnabledUsers: await tx.user.count({
          where: { twoFactorEnabled: true },
        }),
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 120000 },
  );
}

async function verifyAuth(client, database, secrets, source, appCrypto) {
  const { AuthService } = require(
    path.join(root, 'apps/api/dist/modules/auth/auth.service.js'),
  );
  const { generateTotpSecret } = require(
    path.join(root, 'apps/api/dist/core/security/totp.util.js'),
  );
  const values = {
    ...secrets,
    'app.nodeEnv': 'production',
    'jwt.refreshSecret': source.JWT_REFRESH_SECRET?.trim(),
  };
  const config = { get: (name, fallback) => values[name] ?? fallback };
  let result;
  try {
    await client.$transaction(
      async (tx) => {
        currentOperation = 'verify_actual_mfa_seeds';
        await assertTargetDatabase(tx, database);
        const service = new AuthService(tx, {}, {}, config, {}, {});
        const enrolled = await tx.user.findMany({
          where: { twoFactorEnabled: true },
        });
        for (const user of enrolled) {
          const secret = withEncryptionEnvironment(
            { NODE_ENV: 'production', ...secrets },
            () => appCrypto.decryptSensitiveField(user.twoFactorSecret),
          );
          assert.ok(secret);
          const token = testTotp(secret);
          const accepted = withEncryptionEnvironment(
            { NODE_ENV: 'production', ...secrets },
            () => service.verifyMfaChallenge(user, token),
          );
          assert.equal(await accepted, true);
          await assert.rejects(
            service.verifyMfaChallenge(user),
            /Multi-factor/,
          );
        }
        const syntheticSecret = generateTotpSecret();
        currentOperation = 'verify_recovery_codes_and_replay';
        const ciphertext = withEncryptionEnvironment(
          { NODE_ENV: 'production', ...secrets },
          () => appCrypto.encryptSensitiveField(syntheticSecret),
        );
        const legacyCode = crypto.randomBytes(6).toString('hex').toUpperCase();
        let currentCode = crypto.randomBytes(6).toString('hex').toUpperCase();
        while (currentCode === legacyCode)
          currentCode = crypto.randomBytes(6).toString('hex').toUpperCase();
        const legacyHash = crypto
          .createHmac('sha256', secrets.MFA_RECOVERY_CODE_PEPPER_PREV)
          .update(legacyCode)
          .digest('hex');
        const currentHash = service.hashRecoveryCode(currentCode);
        assert.equal(
          currentHash,
          crypto
            .createHmac('sha256', secrets.MFA_RECOVERY_CODE_PEPPER)
            .update(currentCode)
            .digest('hex'),
        );
        const probe = await tx.user.create({
          data: {
            email: `encryption-probe-${crypto.randomUUID()}@example.invalid`,
            passwordHash: 'disabled-rollback-only-probe',
            role: 'TEACHER',
            firstName: 'Migration',
            lastName: 'Probe',
            twoFactorEnabled: true,
            twoFactorSecret: ciphertext,
            mfaRecoveryCodes: [legacyHash, currentHash],
          },
        });
        const attempts = await Promise.allSettled([
          service.verifyMfaChallenge(probe, legacyCode),
          service.verifyMfaChallenge(probe, legacyCode),
        ]);
        assert.equal(
          attempts.filter((attempt) => attempt.status === 'fulfilled').length,
          1,
        );
        assert.equal(
          attempts.filter((attempt) => attempt.status === 'rejected').length,
          1,
        );
        const consumed = await tx.user.findUniqueOrThrow({
          where: { id: probe.id },
        });
        assert.deepEqual(consumed.mfaRecoveryCodes, [currentHash]);
        await assert.rejects(
          service.verifyMfaChallenge(consumed, legacyCode),
          /Invalid MFA/,
        );
        await assert.rejects(
          service.verifyMfaChallenge(consumed, 'not-a-valid-code'),
          /Invalid MFA/,
        );
        assert.equal(
          await service.verifyMfaChallenge(consumed, currentCode),
          true,
        );
        result = {
          realMfaSeedsVerified: enrolled.length,
          missingMfaDenied: true,
          previousPepperAccepted: true,
          newPepperAccepted: true,
          recoveryReplayDenied: true,
          concurrentRecoveryConsumptionDenied: true,
          invalidCodeDenied: true,
        };
        throw new ExpectedRollback('ROLLBACK_AUTH_PROBES');
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error;
  }
  assert.ok(result);
  return result;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'restore-report': { type: 'string' },
      'apply-local': { type: 'boolean', default: false },
    },
  });
  const report = restoreReport(values['restore-report']);
  const source = require('dotenv').parse(
    fs.readFileSync(path.join(root, 'apps/api/.env')),
  );
  const url = restoredTarget(source.LOCAL_DATABASE_URL, report);
  const appCrypto = require(
    path.join(root, 'apps/api/dist/core/security/crypto.util.js'),
  );
  const oldKey = withEncryptionEnvironment(
    { ...source, NODE_ENV: source.NODE_ENV || 'development' },
    () => appCrypto.getPiiEncryptionKey(),
  );
  const oldKeys = [oldKey];
  const previousKey =
    source.PII_ENCRYPTION_KEY_PREV || source.AADHAAR_ENCRYPTION_KEY_PREV;
  if (previousKey) oldKeys.push(keyFromValue(previousKey));
  const originalEnvironment = environmentFingerprint();
  const { PrismaClient } = require(
    require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }),
  );
  const client = new PrismaClient({ datasourceUrl: url.href, log: [] });
  let newKey;
  try {
    currentOperation = 'read_local_restore';
    const before = await snapshot(client, report.restoredDatabase);
    assert.equal(
      Object.keys(before.business).length + 1,
      report.tablesVerified,
    );
    if (!values['apply-local']) {
      console.log(
        JSON.stringify(
          {
            localCopyOnly: true,
            restoredDatabase: report.restoredDatabase,
            users: before.users,
            mfaEnabledUsers: before.mfaEnabledUsers,
            tables: Object.keys(before.business).length + 1,
            changesApplied: false,
          },
          null,
          2,
        ),
      );
      return;
    }
    const secrets = rotationSecrets(source);
    newKey = keyFromValue(secrets.PII_ENCRYPTION_KEY);
    // Authentication of every old envelope is required before creating a key file.
    currentOperation = 'authenticate_existing_encrypted_fields';
    const inventory = await client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await assertTargetDatabase(tx, report.restoredDatabase);
        const rows = await encryptedInventory(tx);
        for (const entry of rows)
          for (const row of entry.rows)
            decryptField(row[entry.field], oldKeys).fill(0);
        return rows;
      },
      { timeout: 30000 },
    );
    assert.equal(inventoryFingerprint(inventory), before.encrypted);
    currentOperation = 'secure_local_artifacts';
    const directory = privateDirectory();
    const secretFile = path.join(directory, 'application-secrets.env');
    fs.writeFileSync(
      secretFile,
      Object.entries(secrets)
        .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
        .join('\n') + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    const options = {
      database: report.restoredDatabase,
      oldKeys,
      newKey,
      expectedFingerprint: before.encrypted,
    };
    currentOperation = 'rollback_rehearsal';
    try {
      await client.$transaction(
        async (tx) => {
          await migrateFields(tx, options);
          throw new ExpectedRollback('ROLLBACK_ENCRYPTION_REHEARSAL');
        },
        { isolationLevel: 'Serializable', timeout: 120000 },
      );
      throw new Error('Rollback rehearsal did not roll back');
    } catch (error) {
      if (!(error instanceof ExpectedRollback)) throw error;
    }
    assert.deepEqual(await snapshot(client, report.restoredDatabase), before);
    currentOperation = 'commit_local_copy_rotation';
    const applied = await client.$transaction(
      async (tx) => {
        const changed = await migrateFields(tx, options);
        saveJournal(
          path.join(directory, 'local-rotation.journal.enc'),
          changed.journal,
          newKey,
        );
        return changed;
      },
      { isolationLevel: 'Serializable', timeout: 120000 },
    );
    const after = await snapshot(client, report.restoredDatabase);
    assert.deepEqual(after.business, before.business);
    assert.equal(after.users, before.users);
    assert.equal(after.mfaEnabledUsers, before.mfaEnabledUsers);
    const auth = await withEncryptionEnvironment(
      { NODE_ENV: 'production', ...secrets },
      () =>
        verifyAuth(client, report.restoredDatabase, secrets, source, appCrypto),
    );
    currentOperation = 'verify_unchanged_active_configuration';
    assert.deepEqual(await snapshot(client, report.restoredDatabase), after);
    assert.deepEqual(environmentFingerprint(), originalEnvironment);
    const evidence = {
      verifiedAt: new Date().toISOString(),
      localCopyOnly: true,
      restoredDatabase: report.restoredDatabase,
      tablesVerified: report.tablesVerified,
      usersPreserved: after.users,
      mfaEnabledUsersPreserved: after.mfaEnabledUsers,
      encryptedFieldsRekeyed: applied.journal.length,
      rollbackRehearsalPassed: true,
      businessDataAndRecoveryHashesPreserved: true,
      auditSnapshotsPreserved: true,
      authenticationProbeRolledBack: true,
      authentication: auth,
      activeEnvironmentFilesUnchanged: true,
      sourceNeonAccessed: false,
      legacyRecoveryPepperRetainedForVerification: true,
      legacyPiiKeyExported: false,
      secretFile,
      liveChangesApplied: false,
      productionAccepted: false,
    };
    fs.writeFileSync(
      path.join(directory, 'verification.json'),
      JSON.stringify(evidence, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    for (const key of oldKeys) key.fill(0);
    if (newKey) newKey.fill(0);
    await client.$disconnect();
  }
}

module.exports = {
  verifyAuth,
  privateDirectory,
  restoreReport,
  withEncryptionEnvironment,
  testTotp,
  saveJournal,
};
if (require.main === module)
  main().catch((error) => {
    console.error(
      'Local encryption rehearsal failed or was refused. No Neon connection or active environment writes were performed. Retain any private artifacts for inspection; do not deploy their keys without a successful report.',
    );
    console.error(
      JSON.stringify({
        operation: currentOperation,
        code: /^[A-Z0-9_]+$/.test(error.code || '')
          ? error.code
          : 'CHECK_FAILED',
        databaseCode: /^[0-9A-Z]{5}$/.test(error.meta?.code || '')
          ? error.meta.code
          : undefined,
      }),
    );
    process.exitCode = 1;
  });
