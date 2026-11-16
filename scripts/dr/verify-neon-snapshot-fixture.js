'use strict';
// Explicit disposable PostgreSQL fixture. No host networking, published ports,
// source database connection, school records, persistent volume or password input.
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { snapshotSql, inventorySql, validateIdentity, validateTables, containerArgs, capture } = require('./scheduled-neon-backup');
async function main() {
  const image = process.argv[2]; assert.match(image || '', /^sha256:[a-f0-9]{64}$/);
  const run = process.argv[3] || crypto.randomBytes(8).toString('hex'); assert.match(run, /^[a-f0-9]{16}$/);
  const name = `erp-neon-fixture-${run}`;
  function cmd(args, input, maxBuffer = 1024 * 1024) {
    const r = spawnSync('docker', args, { input, encoding: input instanceof Buffer || args.includes('pg_dump') ? undefined : 'utf8', timeout: 30000, maxBuffer });
    assert.ok(!r.error && r.status === 0, 'PRIVATE_FIXTURE_COMMAND_FAILED'); return r.stdout;
  }
  function sql(text, database = 'school_erp', user = 'postgres') {
    return cmd(['exec', '-i', name, 'psql', '-X', '-q', '-A', '-t', '--set=ON_ERROR_STOP=on', '-U', user, '-d', database], text);
  }
  let session;
  try {
    cmd(['run', '-d', '--pull=never', '--name', name, '--label', `com.school-erp.neon-fixture=${run}`,
      '--network=none', '--memory=384m', '--memory-swap=384m', '--cpus=0.5', '--pids-limit=128', '--read-only',
      '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=128m', '--tmpfs', '/var/run/postgresql:rw,nosuid,size=16m',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=school_erp', image]);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const r = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'school_erp'], { encoding: 'utf8', timeout: 3000 });
      if (!r.error && r.status === 0) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(ready, true);
    sql(`CREATE ROLE school_erp_backup LOGIN BYPASSRLS;
      GRANT pg_read_all_data TO school_erp_backup;
      CREATE ROLE fixture_runtime LOGIN NOBYPASSRLS;
      CREATE TABLE schools(id int PRIMARY KEY, school_id int, value text);
      CREATE TABLE users(LIKE schools INCLUDING ALL);
      CREATE TABLE domain_audit_events(LIKE schools INCLUDING ALL);
      CREATE TABLE _prisma_migrations(LIKE schools INCLUDING ALL);
      CREATE SCHEMA app_security; CREATE TABLE app_security.fixture_events(LIKE schools INCLUDING ALL);
      INSERT INTO schools VALUES(1,1,'synthetic-a'),(2,2,'synthetic-b');
      INSERT INTO users SELECT * FROM schools; INSERT INTO domain_audit_events SELECT * FROM schools;
      INSERT INTO _prisma_migrations SELECT * FROM schools; INSERT INTO app_security.fixture_events SELECT * FROM schools;
      ALTER TABLE schools ENABLE ROW LEVEL SECURITY; ALTER TABLE schools FORCE ROW LEVEL SECURITY;
      ALTER TABLE users ENABLE ROW LEVEL SECURITY; ALTER TABLE users FORCE ROW LEVEL SECURITY;
      CREATE POLICY school_filter ON schools USING (school_id=1); CREATE POLICY user_filter ON users USING (school_id=1);
      GRANT USAGE ON SCHEMA public TO fixture_runtime; GRANT SELECT ON ALL TABLES IN SCHEMA public TO fixture_runtime;`);
    session = spawn('docker', ['exec', '-i', name, 'psql', '-X', '-q', '-A', '-t', '-U', 'school_erp_backup', '-d', 'school_erp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let bytes = '', role, snapshot; const tables = [];
    session.stderr.resume(); session.stdin.on('error', () => {});
    const closed = new Promise((resolve) => { session.on('close', resolve); session.on('error', () => resolve(-1)); });
    const got = new Promise((resolve, reject) => {
      session.stdout.on('data', (b) => {
        try {
          bytes += b.toString(); assert.ok(bytes.length <= 2 * 1024 * 1024); let i;
          while ((i = bytes.indexOf('\n')) >= 0) {
            const line = bytes.slice(0, i).trim(); bytes = bytes.slice(i + 1); if (!line) continue;
            const v = JSON.parse(line);
            if (v.type === 'identity') role = v;
            else if (v.type === 'snapshot') snapshot = v.snapshot;
            else if (v.type === 'table') { const { type: _type, ...t } = v; tables.push(t); }
            else if (v.type === 'ready') resolve();
          }
        } catch { reject(new Error('FIXTURE_SQL_PROTOCOL_FAILED')); }
      });
      session.on('close', () => reject(new Error('FIXTURE_SNAPSHOT_EXITED')));
    });
    session.stdin.write(snapshotSql);
    let timer;
    try { await Promise.race([got, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('FIXTURE_TIMEOUT')), 60000); })]); }
    finally { clearTimeout(timer); }
    validateIdentity(role, { expectedDatabase: 'school_erp', expectedRole: 'school_erp_backup' }); validateTables(tables);
    assert.equal(tables.length, 5); assert.ok(tables.every((t) => t.count === '2'));
    // This writer is only in the disposable fixture; verify export consistency.
    sql("INSERT INTO users VALUES(3,2,'synthetic-concurrent-writer');");
    const dump = cmd(['exec', name, 'pg_dump', '-U', 'school_erp_backup', '-d', 'school_erp', '--format=custom', `--snapshot=${snapshot}`], undefined, 16 * 1024 * 1024);
    const dumpBytes = Buffer.isBuffer(dump) ? dump : Buffer.from(dump, 'binary');
    await capture(containerArgs({ postgresImage: image }, `erp-neon-${run}-verify`, run, {}, 'pg_restore', ['--list']), {}, dumpBytes, 1024 * 1024, 30000);
    session.stdin.end('ROLLBACK;\n'); assert.equal(await closed, 0); session = null;
    sql('CREATE DATABASE fixture_restore;');
    cmd(['exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d', 'fixture_restore', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction'], dumpBytes);
    const actual = sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL TIME ZONE 'UTC';\n" + inventorySql + 'ROLLBACK;\n', 'fixture_restore')
      .split(/\r?\n/).filter(Boolean).map((line) => { const { type: _type, ...t } = JSON.parse(line); return t; });
    assert.deepEqual(actual, tables);
    assert.equal(sql('SELECT count(*) FROM users;').trim(), '3');
    assert.equal(sql('SELECT count(*) FROM users;', 'fixture_restore').trim(), '2');
    const denied = spawnSync('docker', ['exec', '-i', name, 'psql', '-X', '-q', '-A', '-t', '--set=ON_ERROR_STOP=on', '-U', 'fixture_runtime', '-d', 'school_erp'],
      { input: 'BEGIN READ ONLY; SET LOCAL row_security=off; SELECT count(*) FROM users;', encoding: 'utf8', timeout: 10000 });
    assert.notEqual(denied.status, 0);
    console.log(JSON.stringify({ syntheticOnly: true, sourceConnected: false, sourceUnchanged: true, publicPorts: false,
      snapshotConsistentWithConcurrentFixtureWrite: true, crossTenantRowsIncluded: true, filteredRoleRejected: true,
      restoredTablesAndChecksumsMatched: 5, extraSchemaIncluded: true, postgresMajor: 16 }));
  } finally {
    if (session) session.kill('SIGKILL');
    const found = cmd(['ps', '-aq', '--filter', `name=^/${name}$`]).trim();
    if (found) {
      const d = JSON.parse(cmd(['inspect', name]))[0]; assert.equal(d.Config.Labels['com.school-erp.neon-fixture'], run);
      assert.equal(d.Name, '/' + name); assert.equal(d.Image, image); assert.equal(d.HostConfig.NetworkMode, 'none');
      assert.ok(!Object.keys(d.HostConfig.PortBindings || {}).length && d.Mounts.every((m) => m.Type === 'tmpfs'));
      cmd(['rm', '--force', d.Id]);
    }
    console.log('NEON_SNAPSHOT_FIXTURE_REMOVED');
  }
}
if (require.main === module) main().catch(() => { console.error('NEON_SNAPSHOT_FIXTURE_FAILED; private diagnostics withheld'); process.exitCode = 1; });
