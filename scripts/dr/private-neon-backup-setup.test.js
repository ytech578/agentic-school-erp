const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrivateSetupError, validatePassword, collectPassword, privateFailureMessage, activationSql, backupUrl,
  setupMode, savedTarget, savedConnection, recoverSavedConnection, assertPrivateResume, failureDiagnostic,
  createPrivateDirectory, checkInactive, activate } = require('./private-neon-backup-setup');
test('private password setup requires matching strong ASCII passwords without logging inputs', () => {
  const p = 'Synthetic-only-password-for-unit-tests-123'; assert.doesNotThrow(() => validatePassword(p, p));
  for (const pair of [['short', 'short'], [p, p + 'x'], ['x'.repeat(129), 'x'.repeat(129)], [p + '\n', p + '\n'], ['é'.repeat(40), 'é'.repeat(40)]])
    assert.throws(() => validatePassword(...pair));
});
test('password validation distinguishes paste, format and confirmation failures without disclosing input', () => {
  const p = 'Synthetic-only-password-for-unit-tests-123';
  for (const [pair, code] of [
    [['', ''], 'PASSWORD_EMPTY'], [['short', 'short'], 'PASSWORD_LENGTH'],
    [[p + ' ', p + ' '], 'PASSWORD_ASCII'], [[p + '\u200b', p + '\u200b'], 'PASSWORD_ASCII'],
    [[p, ''], 'CONFIRMATION_EMPTY'], [[p, p + 'x'], 'PASSWORD_CONFIRMATION_MISMATCH'],
  ]) {
    assert.throws(() => validatePassword(...pair), (error) => {
      assert.ok(error instanceof PrivateSetupError); assert.equal(error.code, code);
      const text = privateFailureMessage(error);
      assert.ok(!text.includes(p)); assert.match(text, /No database password change was attempted/); return true;
    });
  }
});
test('private prompt confirms only password length and successful matching, never characters', async () => {
  const p = 'Synthetic-only-password-for-unit-tests-123'; const answers = [p, p]; const prompts = [], messages = [];
  const result = await collectPassword(async (prompt) => { prompts.push(prompt); return answers.shift(); }, (line) => messages.push(line));
  assert.equal(result, p); assert.equal(prompts.length, 2);
  assert.ok(messages.some((line) => line.includes(`${p.length} characters`)));
  assert.ok(messages.some((line) => line.includes('confirmation matched')));
  assert.ok(messages.every((line) => !line.includes(p))); assert.ok(prompts.every((line) => !line.includes(p)));
});
test('invalid password and mismatched confirmation retry within the helper before activation', async () => {
  const p = 'Synthetic-only-password-for-unit-tests-123'; const answers = ['short', p, p + 'x', p, p]; const messages = [];
  const result = await collectPassword(async () => answers.shift(), (line) => messages.push(line));
  assert.equal(result, p); assert.equal(answers.length, 0);
  assert.ok(messages.some((line) => line.includes('32 to 128')));
  assert.ok(messages.some((line) => line.includes('did not match')));
  assert.ok(messages.some((line) => line.includes('Try again (3 of 3)')));
  assert.ok(messages.every((line) => !line.includes(p)));
});
test('three unsuccessful private attempts stop without reaching activation', async () => {
  let questions = 0; const messages = [];
  await assert.rejects(collectPassword(async (prompt) => {
    questions++; assert.match(prompt, /^New backup password/); return '';
  }, (line) => messages.push(line)), (error) => error.code === 'PASSWORD_RETRIES_EXHAUSTED');
  assert.equal(questions, 3); assert.ok(messages.every((line) => !line.includes('Type ACTIVATE')));
});
test('private failure messages never reflect arbitrary exceptions or suggest retrying committed activation', async () => {
  const secret = 'SYNTHETIC-PRIVATE-EXCEPTION-MUST-NOT-APPEAR-123';
  for (const error of [new Error(secret), new Error(`Database URL postgresql://${secret}`), { code: 'PASSWORD_EMPTY', message: secret }, new PrivateSetupError(secret)]) {
    assert.ok(!privateFailureMessage(error).includes(secret));
    for (const verified of [false, true]) {
      const message = privateFailureMessage(error, { attempted: true, verified });
      assert.ok(!message.includes(secret)); assert.match(message, /Do not rerun or reset/);
      assert.ok(!message.includes('No database password change'));
    }
  }
  const abort = new Error(secret); abort.name = 'AbortError';
  const prompts = [];
  await assert.rejects(collectPassword(async () => { throw abort; }, (line) => prompts.push(line)), (error) => error === abort);
  assert.equal(prompts.length, 0); assert.match(privateFailureMessage(abort), /CANCELLED before activation/);
});
test('Neon activation uses the original password in exactly one safely escaped E-string, not a pre-hash', () => {
  const examples = [Array.from({ length: 94 }, (_, i) => String.fromCharCode(i + 33)).join(''),
    "synthetic-quote-'\\';GRANT/**/postgres/**/TO/**/public;--", ...Array.from({ length: 100 }, () =>
      Array.from({ length: 64 }, () => String.fromCharCode(33 + crypto.randomInt(94))).join(''))];
  for (const password of examples) {
    const query = activationSql(password); const prefix = "ALTER ROLE school_erp_backup PASSWORD E'";
    assert.ok(query.startsWith(prefix)); assert.ok(query.endsWith("' LOGIN"));
    const literal = query.slice(prefix.length, -"' LOGIN".length); let decoded = '';
    for (let i = 0; i < literal.length; i++) {
      const ch = literal[i];
      if (ch === "'" || ch === '\\') { assert.equal(literal[++i], ch); }
      decoded += ch;
    }
    assert.equal(decoded, password);
  }
  assert.throws(() => activationSql('SCRAM-SHA-256$4096:already-hashed-test-value'), (error) => error.code === 'PASSWORD_LOOKS_HASHED');
  assert.throws(() => activationSql('md5' + 'a'.repeat(32)), (error) => error.code === 'PASSWORD_LOOKS_HASHED');
});
test('private exported connection contains only the dedicated user with correctly encoded password and strict target', () => {
  const password = 'synthetic@:/#&?special-password-test-only';
  const url = new URL(backupUrl('postgresql://school_erp_owner:OWNER-NOT-EXPORTED@ep-fixture.aws.neon.tech/school_erp?schema=public&sslaccept=strict', password));
  assert.equal(url.username, 'school_erp_backup'); assert.equal(decodeURIComponent(url.password), password);
  assert.equal(url.hostname, 'ep-fixture.aws.neon.tech'); assert.equal(url.pathname, '/school_erp');
  assert.equal(url.searchParams.get('sslmode'), 'verify-full'); assert.ok(!url.href.includes('OWNER-NOT-EXPORTED'));
  assert.deepEqual([...url.searchParams.keys()].sort(), ['connect_timeout', 'sslmode']);
});
function txFixture({ login = false, admin = false, extra = false, writes = false } = {}) {
  const commands = []; return { commands,
    $queryRawUnsafe: async (sql) => sql.startsWith('SELECT current_database()') ? [{ database: 'school_erp', actor: 'school_erp_owner' }]
      : sql.includes('pg_auth_members') ? (extra ? [{ name: 'neon_superuser' }, { name: 'pg_read_all_data' }] : [{ name: 'pg_read_all_data' }])
        : [{ login, bypass: true, elevated: admin, reader: true, default_readonly: true, elevated_membership: false, writes, owns: false, schema_create: false, database_create: false }],
    $executeRawUnsafe: async (sql) => { commands.push(sql); },
  };
}
test('activation still refuses active or expanded roles before provider-compatible password DDL', async () => {
  const p = 'Synthetic-only-password-for-unit-tests-123';
  const tx = txFixture(); await activate(tx, p);
  assert.deepEqual(tx.commands, [activationSql(p)]);
  for (const opts of [{ login: true }, { admin: true }, { extra: true }, { writes: true }]) {
    const bad = txFixture(opts); await assert.rejects(activate(bad, p)); assert.equal(bad.commands.length, 0);
  }
  await assert.rejects(activate(txFixture(), "unsafe' input"));
});
test('resume mode requires its exact explicit switch and accepts no password arguments', () => {
  assert.equal(setupMode([]), 'new'); assert.equal(setupMode(['--resume-inactive-setup']), 'resume');
  for (const args of [['synthetic-secret'], ['--resume-inactive-setup', 'synthetic-secret'], ['--force']])
    assert.throws(() => setupMode(args), (error) => error.code === 'PASSWORD_ARGUMENTS_NOT_ALLOWED');
});
test('retained connection review preserves the password but rejects alternate targets or extra settings', () => {
  const owner = 'postgresql://school_erp_owner:OWNER-SYNTHETIC@ep-fixture.aws.neon.tech/school_erp?sslmode=require';
  const password = "Synthetic-retained-password-with-'\\-12345";
  const connection = backupUrl(owner, password); const text = `NEON_BACKUP_DATABASE_URL='${connection}'\n`;
  assert.ok(!connection.includes("'")); assert.deepEqual(savedConnection(text, owner), { connection, password });
  assert.equal(require('dotenv').parse(text).NEON_BACKUP_DATABASE_URL, connection);
  for (const bad of [text.replace('school_erp_backup', 'school_erp_owner'), text.replace('ep-fixture', 'ep-another'),
    text.replace('verify-full', 'disable'), text.replace('school_erp?', 'another_db?'),
    text.replace('connect_timeout=20', 'connect_timeout=20&host=other'), text + text,
    text.replace('neon.tech/school_erp', 'neon.tech:1234/school_erp')]) {
    assert.throws(() => savedConnection(bad, owner), (error) => {
      assert.equal(error.code, 'SAVED_SETUP_NOT_ACCEPTED'); assert.ok(!privateFailureMessage(error).includes(password)); return true;
    });
  }
});
test('legacy raw percent passwords require original-password confirmation, never guessed decoding', () => {
  const owner = 'postgresql://school_erp_owner:OWNER-SYNTHETIC@ep-fixture.aws.neon.tech/school_erp?sslmode=require';
  for (const tail of ['%not-an-escape', '%41', '%20', '%E2%82%AC', '%2525', '%', '%ab']) {
    const password = 'Synthetic-original-backup-password-' + tail;
    const legacy = new URL(owner); legacy.username = 'school_erp_backup'; legacy.password = password;
    legacy.search = '?sslmode=verify-full&connect_timeout=20';
    const text = `NEON_BACKUP_DATABASE_URL='${legacy.href}'\n`; const original = text;
    assert.equal(savedTarget(text, owner), legacy.href);
    const recovered = recoverSavedConnection(text, owner, password);
    assert.equal(recovered.password, password); assert.equal(recovered.connection, backupUrl(owner, password));
    assert.equal(decodeURIComponent(new URL(recovered.connection).password), password);
    assert.equal(recovered.separateCanonicalFileRequired, true); assert.equal(text, original);
    assert.throws(() => recoverSavedConnection(text, owner, password + 'wrong'), (error) => error.code === 'SAVED_PASSWORD_DOES_NOT_MATCH');
    assert.throws(() => recoverSavedConnection(text.replace('ep-fixture', 'ep-foreign'), owner, password),
      (error) => error.code === 'SAVED_SETUP_NOT_ACCEPTED');
  }
  const invalid = new URL(owner); invalid.username = 'school_erp_backup'; invalid.password = 'Synthetic-original-backup-password-%x';
  invalid.search = '?sslmode=verify-full&connect_timeout=20';
  assert.throws(() => savedConnection(`NEON_BACKUP_DATABASE_URL='${invalid.href}'\n`, owner),
    (error) => error.code === 'SAVED_PASSWORD_CONFIRMATION_REQUIRED');
});
test('canonical resume confirms the original secret and needs no replacement file', () => {
  const owner = 'postgresql://school_erp_owner:OWNER-SYNTHETIC@ep-fixture.aws.neon.tech/school_erp?sslmode=require';
  const password = 'Synthetic-backup-password-characters-%:@-123'; const connection = backupUrl(owner, password);
  const recovered = recoverSavedConnection(`NEON_BACKUP_DATABASE_URL='${connection}'\n`, owner, password);
  assert.deepEqual(recovered, { connection, password, separateCanonicalFileRequired: false });
});
test('resume private prompts explicitly ask for the ORIGINAL password and never expose it', async () => {
  const password = 'Synthetic-original-backup-password-12345'; const answers = [password, password];
  const prompts = [], messages = [];
  assert.equal(await collectPassword(async (prompt) => { prompts.push(prompt); return answers.shift(); }, (line) => messages.push(line), true), password);
  assert.deepEqual(prompts, ['Original saved backup password (hidden): ', 'Repeat original saved password (hidden): ']);
  assert.ok(!JSON.stringify({ prompts, messages }).includes(password));
});
test('resume permission checks reject absent configuration without creating it', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-private-resume-unit-'));
  const file = path.join(directory, 'database.env');
  try {
    assert.throws(() => assertPrivateResume(directory, file), (error) => error.code === 'SAVED_SETUP_NOT_ACCEPTED');
    assert.equal(fs.existsSync(file), false);
  } finally { fs.rmdirSync(directory); }
});
test('real protected fixture permissions pass the resume guard without modifying its contents', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-resume-acl-fixture-'));
  const directory = path.join(parent, 'protected'), file = path.join(directory, 'database.env');
  try {
    createPrivateDirectory(directory);
    const synthetic = 'SYNTHETIC-NON-CREDENTIAL-FIXTURE-ONLY';
    fs.writeFileSync(file, synthetic, { flag: 'wx', mode: 0o600 });
    assert.doesNotThrow(() => assertPrivateResume(directory, file));
    assert.equal(fs.readFileSync(file, 'utf8'), synthetic);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(directory)) fs.rmdirSync(directory);
    fs.rmdirSync(parent);
  }
});
test('failed-activation diagnostic stores only safe codes and stage, never SQL, URL or credential text', () => {
  const secret = 'SYNTHETIC-PRIVATE-DIAGNOSTIC-123';
  const r = failureDiagnostic({ code: 'P2010', meta: { code: '22023', message: secret, query: secret }, message: secret }, 'ACTIVATION_TRANSACTION', true);
  assert.equal(r.code, 'P2010'); assert.equal(r.sqlState, '22023'); assert.equal(r.outcome, 'requires_read_only_reconciliation');
  assert.ok(!JSON.stringify(r).includes(secret));
  const unknown = failureDiagnostic({ code: secret, meta: { code: secret } }, 'PRIVATE_INPUT', false);
  assert.equal(unknown.code, 'PRIVATE_ERROR'); assert.equal(unknown.sqlState, null);
  const untrusted = failureDiagnostic(new PrivateSetupError(secret), secret, false);
  assert.equal(untrusted.code, 'PRIVATE_ERROR'); assert.equal(untrusted.stage, 'UNKNOWN_STAGE');
  assert.ok(!JSON.stringify(untrusted).includes(secret));
});
