'use strict';
// OPERATOR-RUN ONLY. Never invoke from an agent with password arguments/stdin.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const { target } = require('../db/prepare-neon-backup-role');
class PrivateSetupError extends Error {
  constructor(code) { super(code); this.name = 'PrivateSetupError'; this.code = code; }
}
const inputMessages = Object.freeze({
  PASSWORD_EMPTY: 'No password was received. Use the terminal Paste action (for Windows PowerShell, try right-click), then press Enter. Do not type ACTIVATE yet.',
  PASSWORD_LENGTH: 'The password must contain 32 to 128 characters. Copy the saved password only, without its label or surrounding quotes.',
  PASSWORD_ASCII: 'The password contains a space, control character or non-ASCII character. Use random English letters and numbers without spaces; do not include quotes around it.',
  PASSWORD_LOOKS_HASHED: 'Neon requires the original generated password, not a SCRAM or MD5 hash. Use your saved random password.',
  CONFIRMATION_EMPTY: 'No confirmation was received. Paste the same saved password at both password prompts.',
  PASSWORD_CONFIRMATION_MISMATCH: 'The two entries did not match. Copy the saved password again and paste that same value at both prompts.',
  PASSWORD_RETRIES_EXHAUSTED: 'Three password attempts failed. Setup stopped before activation. Run the helper again when ready; do not type ACTIVATE at the PowerShell PS prompt.',
  USE_A_DISTINCT_BACKUP_PASSWORD: 'Use a new backup-account password, not the database owner password. Setup stopped before activation.',
  NOT_ACTIVATED: 'Activation cancelled: ACTIVATE was not entered at the helper confirmation prompt. Do not run ACTIVATE as a PowerShell command.',
  EXISTING_PRIVATE_SETUP_REQUIRES_REVIEW: 'Private setup files already exist. Do not rerun, delete files or reset the password; request a setup review.',
  PRIVATE_FILE_PROTECTION_FAILED: 'The private configuration folder could not be protected. No password change was attempted; request a file-permissions review.',
  SAVED_SETUP_NOT_ACCEPTED: 'The retained setup file, target or private permissions did not pass review. Nothing was overwritten. Keep the files and request a review.',
  SAVED_PASSWORD_CONFIRMATION_REQUIRED: 'The retained connection has legacy password encoding. Confirm the original saved password through the reviewed resume flow; do not edit or delete the file.',
  SAVED_PASSWORD_DOES_NOT_MATCH: 'The entered password does not match the retained setup. Use the ORIGINAL password from your password manager, not a new password. Nothing was changed.',
  REVIEWED_CONNECTION_ALREADY_EXISTS: 'A separately reviewed connection file already exists. Keep both files and request a read-only review; do not overwrite or rerun activation.',
  RUN_PRIVATELY_IN_AN_INTERACTIVE_TERMINAL: 'Run this helper yourself in an interactive PowerShell window. Password arguments, redirected input and chat input are not supported.',
  PASSWORD_ARGUMENTS_NOT_ALLOWED: 'Run only node followed by the script path. Enter the password at its hidden prompt, never as a command argument.',
});
function validatePasswordFormat(password) {
  if (typeof password !== 'string' || !password.length) throw new PrivateSetupError('PASSWORD_EMPTY');
  if (password.length < 32 || password.length > 128) throw new PrivateSetupError('PASSWORD_LENGTH');
  if (!/^[\x21-\x7e]+$/.test(password)) throw new PrivateSetupError('PASSWORD_ASCII');
  if (password.startsWith('SCRAM-SHA-256$') || /^md5[a-f0-9]{32}$/i.test(password)) throw new PrivateSetupError('PASSWORD_LOOKS_HASHED');
}
function validatePassword(password, confirmation) {
  validatePasswordFormat(password);
  if (typeof confirmation !== 'string' || !confirmation.length) throw new PrivateSetupError('CONFIRMATION_EMPTY');
  const a = Buffer.from(password), b = Buffer.from(confirmation || '');
  try { if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new PrivateSetupError('PASSWORD_CONFIRMATION_MISMATCH'); }
  finally { a.fill(0); b.fill(0); }
}
async function collectPassword(question, write, existing = false) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let password, confirmation;
    try {
      password = await question(existing ? 'Original saved backup password (hidden): ' : 'New backup password (hidden): ');
      validatePasswordFormat(password);
      // Length is non-secret feedback; never echo characters or clipboard contents.
      write(`Password received: ${password.length} characters. Its contents remain hidden.`);
      confirmation = await question(existing ? 'Repeat original saved password (hidden): ' : 'Repeat password (hidden): ');
      validatePassword(password, confirmation);
      write('Password confirmation matched. The helper will ask for ACTIVATE next; it is not a PowerShell command.');
      return password;
    } catch (error) {
      if (!(error instanceof PrivateSetupError) || !Object.hasOwn(inputMessages, error.code)) throw error;
      write(inputMessages[error.code]);
      if (attempt < 3) write(`Try again (${attempt + 1} of 3). Nothing has been activated.`);
    } finally { password = undefined; confirmation = undefined; }
  }
  throw new PrivateSetupError('PASSWORD_RETRIES_EXHAUSTED');
}
function privateFailureMessage(error, { attempted = false, verified = false } = {}) {
  if (attempted) return verified
    ? 'SETUP REQUIRES REVIEW: the backup login was verified, but final setup did not complete. Keep the private connection file. Do not rerun or reset the password; report only this message.'
    : 'SETUP REQUIRES REVIEW: activation may have committed. Private connection file retained. Do not rerun or reset the password; report only this message.';
  if (error instanceof PrivateSetupError && Object.hasOwn(inputMessages, error.code))
    return `PRIVATE SETUP NOT COMPLETED: ${inputMessages[error.code]} No database password change was attempted.`;
  if (error?.name === 'AbortError') return 'PRIVATE SETUP CANCELLED before activation. No database password change was attempted.';
  // Never print arbitrary exception messages: they may contain credentials or SQL.
  return 'PRIVATE SETUP NOT COMPLETED before activation. No database password change was attempted. Private diagnostics withheld; report only this message. Do not type ACTIVATE at the PowerShell PS prompt.';
}
// Neon rejects supplied password hashes. This operator-only DDL sends the
// password over strict TLS; PostgreSQL encrypts it for storage. No SQL/error logs.
// E-string escaping is independent of standard_conforming_strings. ALTER ROLE
// cannot bind the password as a normal SQL value parameter.
function activationSql(password) {
  validatePasswordFormat(password);
  return `ALTER ROLE school_erp_backup PASSWORD E'${password.replace(/\\/g, '\\\\').replace(/'/g, "''")}' LOGIN`;
}
function backupUrl(ownerUrl, password) {
  const u = new URL(ownerUrl); u.username = 'school_erp_backup';
  // Quote-safe for the single-quoted dotenv value, including apostrophes.
  u.password = encodeURIComponent(password).replace(/'/g, '%27');
  u.search = ''; u.searchParams.set('sslmode', 'verify-full'); u.searchParams.set('connect_timeout', '20'); return u.href;
}
function checked(program, args) {
  const r = spawnSync(program, args, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (r.error || r.status !== 0) throw new PrivateSetupError('PRIVATE_FILE_PROTECTION_FAILED');
  return r.stdout;
}
function createPrivateDirectory(directory) {
  if (fs.existsSync(directory)) throw new PrivateSetupError('EXISTING_PRIVATE_SETUP_REQUIRES_REVIEW');
  fs.mkdirSync(directory, { mode: 0o700 });
  if (process.platform === 'win32') {
    const sid = checked('whoami.exe', ['/user', '/fo', 'csv', '/nh']).match(/S-1-\d+(?:-\d+)+/);
    assert.ok(sid);
    checked('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid[0]}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F']);
  } else { fs.chmodSync(directory, 0o700); const s = fs.lstatSync(directory); assert.equal(s.uid, process.getuid()); assert.equal(s.mode & 0o077, 0); }
}
function setupMode(args) {
  if (!args.length) return 'new';
  if (args.length === 1 && args[0] === '--resume-inactive-setup') return 'resume';
  throw new PrivateSetupError('PASSWORD_ARGUMENTS_NOT_ALLOWED');
}
function savedTarget(text, ownerUrl) {
  try {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('#'));
    assert.equal(lines.length, 1); assert.match(lines[0], /^NEON_BACKUP_DATABASE_URL=/);
    const env = require('dotenv').parse(text); assert.deepEqual(Object.keys(env), ['NEON_BACKUP_DATABASE_URL']);
    const connection = env.NEON_BACKUP_DATABASE_URL;
    const u = new URL(connection), owner = new URL(ownerUrl);
    assert.equal(u.protocol, owner.protocol); assert.equal(u.host, owner.host); assert.equal(u.pathname, owner.pathname);
    assert.equal(decodeURIComponent(u.username), 'school_erp_backup');
    assert.ok(!u.hash && u.password); assert.equal(u.search, '?sslmode=verify-full&connect_timeout=20');
    return connection;
  } catch { throw new PrivateSetupError('SAVED_SETUP_NOT_ACCEPTED'); }
}
function savedConnection(text, ownerUrl) {
  const connection = savedTarget(text, ownerUrl); let password;
  try { password = decodeURIComponent(new URL(connection).password); }
  catch { throw new PrivateSetupError('SAVED_PASSWORD_CONFIRMATION_REQUIRED'); }
  try {
    validatePasswordFormat(password);
    assert.notEqual(password, decodeURIComponent(new URL(ownerUrl).password));
    return { connection, password };
  } catch { throw new PrivateSetupError('SAVED_SETUP_NOT_ACCEPTED'); }
}
function recoverSavedConnection(text, ownerUrl, password) {
  const retained = savedTarget(text, ownerUrl);
  validatePasswordFormat(password);
  if (password === decodeURIComponent(new URL(ownerUrl).password)) throw new PrivateSetupError('USE_A_DISTINCT_BACKUP_PASSWORD');
  const canonical = backupUrl(ownerUrl, password);
  // Reconstruct the OLD encoder only for exact comparison with the retained
  // record. Never decode/reinterpret malformed or ambiguous percent escapes.
  const legacy = new URL(ownerUrl); legacy.username = 'school_erp_backup'; legacy.password = password;
  legacy.search = ''; legacy.searchParams.set('sslmode', 'verify-full'); legacy.searchParams.set('connect_timeout', '20');
  if (retained !== canonical && retained !== legacy.href) throw new PrivateSetupError('SAVED_PASSWORD_DOES_NOT_MATCH');
  return { connection: canonical, password, separateCanonicalFileRequired: retained !== canonical };
}
function assertPrivateResume(directory, file) {
  try {
    for (const [p, directoryExpected] of [[directory, true], [file, false]]) {
      const s = fs.lstatSync(p); assert.ok(!s.isSymbolicLink());
      assert.equal(s.isDirectory(), directoryExpected); if (!directoryExpected) assert.ok(s.isFile());
      if (process.platform !== 'win32') assert.ok(s.uid === process.getuid() && !(s.mode & 0o077));
    }
    if (process.platform === 'win32') {
      const literal = (p) => "'" + p.replace(/'/g, "''") + "'";
      // A parent PowerShell 7 PSModulePath can otherwise make Windows PowerShell
      // 5.1 auto-load an incompatible Security module. Use its own bundled one.
      const script = `$ErrorActionPreference='Stop'; Import-Module ($PSHOME+'\\Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop; ` +
        `$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; ` +
        `$taskPaths=@(${[directory, file].map(literal).join(',')}); foreach($taskPath in $taskPaths){ ` +
        `$taskAcl=Get-Acl -LiteralPath $taskPath; ` +
        `if($taskPath -eq $taskPaths[0] -and -not $taskAcl.AreAccessRulesProtected){exit 1}; ` +
        `$taskOwner=$taskAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value; if($taskOwner -notin @($taskSid,'S-1-5-18')){exit 1}; ` +
        `$taskRules=@($taskAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])); if($taskRules.Count -eq 0){exit 1}; ` +
        `foreach($taskRule in $taskRules){if($taskRule.AccessControlType -ne 'Allow' -or $taskRule.IdentityReference.Value -notin @($taskSid,'S-1-5-18')){exit 1}} }; Write-Output 'PRIVATE_ACL_OK'`;
      const result = checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);
      assert.equal(result.trim(), 'PRIVATE_ACL_OK');
    }
  } catch { throw new PrivateSetupError('SAVED_SETUP_NOT_ACCEPTED'); }
}
function failureDiagnostic(error, stage, attempted) {
  const stages = ['PREFLIGHT', 'PRIVATE_INPUT', 'ACTIVATION_TRANSACTION', 'AUTHENTICATED_READ_ONLY_CHECK', 'COMPLETION_REPORT'];
  return { recordedAt: new Date().toISOString(), stage: stages.includes(stage) ? stage : 'UNKNOWN_STAGE', activationAttempted: attempted === true,
    outcome: attempted ? 'requires_read_only_reconciliation' : 'no_activation_attempted',
    code: /^P\d{4}$/.test(error?.code || '') ? error.code
      : error instanceof PrivateSetupError && Object.hasOwn(inputMessages, error.code) ? error.code : 'PRIVATE_ERROR',
    sqlState: /^[A-Z0-9]{5}$/.test(error?.meta?.code || '') ? error.meta.code : null,
    credentialsIncluded: false, rawMessageIncluded: false };
}
async function checkInactive(tx) {
  const [d] = await tx.$queryRawUnsafe('SELECT current_database() AS database,current_user AS actor');
  assert.equal(d.database, 'school_erp'); assert.equal(d.actor, 'school_erp_owner');
  const [r] = await tx.$queryRawUnsafe(`SELECT rolcanlogin AS login,rolbypassrls AS bypass,
    rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication AS elevated,
    pg_has_role(r.oid,'pg_read_all_data','MEMBER') AS reader,
    COALESCE('default_transaction_read_only=on'=ANY(r.rolconfig),false) AS default_readonly,
    EXISTS(SELECT 1 FROM pg_roles e WHERE (e.rolsuper OR e.rolcreatedb OR e.rolcreaterole OR e.rolreplication) AND pg_has_role(r.oid,e.oid,'MEMBER')) AS elevated_membership,
    EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname NOT IN ('pg_catalog','information_schema') AND t.schemaname !~ '^pg_toast' AND has_table_privilege(r.oid,format('%I.%I',t.schemaname,t.tablename),'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')) AS writes,
    EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' AND pg_has_role(r.oid,t.relowner,'MEMBER')) AS owns,
    has_schema_privilege(r.oid,'public','CREATE') AS schema_create,
    has_database_privilege(r.oid,current_database(),'CREATE') AS database_create
    FROM pg_roles r WHERE rolname=$1`, 'school_erp_backup');
  assert.ok(r); assert.equal(r.login, false); assert.equal(r.bypass, true); assert.equal(r.elevated, false); assert.equal(r.reader, true);
  assert.equal(r.default_readonly, true);
  for (const k of ['elevated_membership', 'writes', 'owns', 'schema_create', 'database_create']) assert.equal(r[k], false);
  const rows = await tx.$queryRawUnsafe(`SELECT p.rolname AS name FROM pg_auth_members m JOIN pg_roles p ON p.oid=m.roleid
    WHERE m.member=to_regrole($1) ORDER BY p.rolname`, 'school_erp_backup');
  assert.deepEqual(rows.map((v) => v.name), ['pg_read_all_data']);
}
async function activate(tx, password) {
  await checkInactive(tx);
  await tx.$executeRawUnsafe(activationSql(password));
}
async function authenticatedCheck(db) {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const [d] = await tx.$queryRawUnsafe(`SELECT current_database() AS database,current_user AS role,
      current_setting('transaction_read_only')='on' AS readonly`);
    assert.equal(d.database, 'school_erp'); assert.equal(d.role, 'school_erp_backup'); assert.equal(d.readonly, true);
    const [r] = await tx.$queryRawUnsafe(`SELECT rolcanlogin AS login,rolbypassrls AS bypass,
      rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication AS elevated FROM pg_roles WHERE rolname=current_user`);
    assert.equal(r.login, true); assert.equal(r.bypass, true); assert.equal(r.elevated, false);
  }, { timeout: 15000 });
}
async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new PrivateSetupError('RUN_PRIVATELY_IN_AN_INTERACTIVE_TERMINAL');
  const mode = setupMode(process.argv.slice(2));
  const root = path.resolve(__dirname, '../..');
  const env = require('dotenv').parse(fs.readFileSync(path.join(root, 'apps/api/.env')));
  const ownerUrl = target(env);
  const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }));
  const owner = new PrismaClient({ datasourceUrl: ownerUrl, log: [] }); let reader;
  const directory = path.join(root, 'backups/onboarding/neon-private-credentials');
  let attempted = false, verified = false, file, createdFile = false, stage = 'PREFLIGHT';
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const rl = require('node:readline/promises').createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController(); rl.on('SIGINT', () => abort.abort());
  async function question(prompt) {
    process.stdout.write(prompt); const v = await rl.question('', { signal: abort.signal }); process.stdout.write('\n'); return v;
  }
  try {
    if (mode === 'new' && fs.existsSync(directory)) throw new PrivateSetupError('EXISTING_PRIVATE_SETUP_REQUIRES_REVIEW');
    if (mode === 'resume') {
      file = path.join(directory, 'database.env'); assertPrivateResume(directory, file);
      if (fs.existsSync(path.join(directory, 'setup-result.json'))) throw new PrivateSetupError('EXISTING_PRIVATE_SETUP_REQUIRES_REVIEW');
    }
    await owner.$transaction(async (tx) => { await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY'); await checkInactive(tx); }, { timeout: 15000 });
    console.log('Private setup for school_erp_backup only. ERP connections, RLS and backup timers will not change.');
    stage = 'PRIVATE_INPUT'; let password, connection, retainedText, separateCanonicalFileRequired = false;
    if (mode === 'resume') {
      retainedText = fs.readFileSync(file, 'utf8'); savedTarget(retainedText, ownerUrl);
      console.log('Reviewed resume: the backup role is still inactive. Keep the original protected file.');
      console.log('Paste the ORIGINAL backup password from your password manager twice to confirm the saved connection. Do not generate a new password.');
      password = await collectPassword(question, (message) => console.log(message), true);
      ({ connection, separateCanonicalFileRequired } = recoverSavedConnection(retainedText, ownerUrl, password));
      if (separateCanonicalFileRequired) {
        if (fs.existsSync(path.join(directory, 'database-reviewed.env'))) throw new PrivateSetupError('REVIEWED_CONNECTION_ALREADY_EXISTS');
        console.log('Legacy password encoding confirmed. After ACTIVATE, a separate protected database-reviewed.env will be created; the original file stays unchanged.');
      } else console.log('The original saved password matches the retained connection. No connection file needs replacement.');
    } else {
      console.log('Generate and save a unique random 32–128 character ASCII password in your password manager.');
      console.log('Password entry is hidden. Do not send the password or URL to chat.');
      console.log('Use your terminal Paste action. Do not type ACTIVATE until this helper explicitly asks for it.');
      password = await collectPassword(question, (message) => console.log(message));
      connection = backupUrl(ownerUrl, password);
    }
    if (password === decodeURIComponent(new URL(ownerUrl).password)) throw new PrivateSetupError('USE_A_DISTINCT_BACKUP_PASSWORD');
    console.log('Neon requires sending the password (not a pre-hashed value) over verified TLS. It is encrypted for storage and never printed by this helper.');
    const approved = await question('Type ACTIVATE to set this password and enable only the backup reader login: ');
    if (approved !== 'ACTIVATE') throw new PrivateSetupError('NOT_ACTIVATED');
    if (mode === 'resume') {
      assertPrivateResume(directory, file);
      if (fs.readFileSync(file, 'utf8') !== retainedText) throw new PrivateSetupError('SAVED_SETUP_NOT_ACCEPTED');
      if (separateCanonicalFileRequired) {
        file = path.join(directory, 'database-reviewed.env');
        fs.writeFileSync(file, `NEON_BACKUP_DATABASE_URL='${connection}'\n`, { flag: 'wx', mode: 0o600 }); createdFile = true;
      }
    }
    if (mode === 'new') {
      createPrivateDirectory(directory); file = path.join(directory, 'database.env');
      fs.writeFileSync(file, `NEON_BACKUP_DATABASE_URL='${connection}'\n`, { flag: 'wx', mode: 0o600 }); createdFile = true;
    }
    stage = 'ACTIVATION_TRANSACTION'; attempted = true;
    await owner.$transaction((tx) => activate(tx, password), { timeout: 30000 }); password = undefined;
    stage = 'AUTHENTICATED_READ_ONLY_CHECK';
    const checkUrl = new URL(connection); checkUrl.searchParams.set('sslmode', 'require'); checkUrl.searchParams.set('sslaccept', 'strict');
    reader = new PrismaClient({ datasourceUrl: checkUrl.href, log: [] }); await authenticatedCheck(reader); verified = true;
    stage = 'COMPLETION_REPORT';
    fs.writeFileSync(path.join(directory, 'setup-result.json'), JSON.stringify({ verifiedAt: new Date().toISOString(),
      role: 'school_erp_backup', operatorEnteredPasswordPrivately: true, loginEnabled: true, authenticatedReadOnlyCheckPassed: true,
      ownerCredentialExported: false, erpRuntimeChanged: false, backupTimersEnabled: false,
      connectionFile: path.basename(file) }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log('PRIVATE NEON SETUP COMPLETE: backup reader login verified; timers remain disabled.');
    console.log(`Verified private connection file: backups/onboarding/neon-private-credentials/${path.basename(file)}. Do not open or paste it in chat.`);
  } catch (error) {
    // Existing credentials must survive cancelled/failed resume attempts unchanged.
    if (createdFile && !attempted && fs.existsSync(file)) fs.unlinkSync(file);
    if (attempted) {
      try { fs.writeFileSync(path.join(directory, `setup-review-${crypto.randomBytes(8).toString('hex')}.json`),
        JSON.stringify(failureDiagnostic(error, stage, attempted), null, 2), { flag: 'wx', mode: 0o600 }); }
      catch { /* Do not expose private filesystem errors or credentials. */ }
    }
    console.error(privateFailureMessage(error, { attempted, verified }));
    process.exitCode = 1;
  } finally { rl.close(); output.end(); if (reader) await reader.$disconnect(); await owner.$disconnect(); }
}
module.exports = { PrivateSetupError, validatePassword, collectPassword, privateFailureMessage, activationSql, backupUrl,
  setupMode, savedTarget, savedConnection, recoverSavedConnection, assertPrivateResume, failureDiagnostic, createPrivateDirectory, checkInactive, activate, authenticatedCheck };
if (require.main === module) main().catch((error) => {
  // Initialization errors can be explained safely. An unexpected final cleanup
  // error must not claim that a previously submitted activation never happened.
  console.error(error instanceof PrivateSetupError ? privateFailureMessage(error)
    : 'PRIVATE SETUP REQUIRES REVIEW; sensitive diagnostics withheld. If activation was submitted, do not rerun or reset the password. Report only this message.');
  process.exitCode = 1;
});
