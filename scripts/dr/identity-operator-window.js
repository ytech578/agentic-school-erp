'use strict';
// Operator-only restored login window. No password, OTP or recovery code inputs.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { loadRecoveryArchive, drill } = require('./identity-recovery');
const maximumWindowMs = 30 * 60 * 1000;
const loopbackPort = 28082;
function bridgeScriptForPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid loopback bridge port');
  return `import os,selectors,socket
s=socket.create_connection(('127.0.0.1',${port}),timeout=15)
s.settimeout(None)
poll=selectors.DefaultSelector()
poll.register(0,selectors.EVENT_READ)
poll.register(s,selectors.EVENT_READ)
try:
 while True:
  for key,_ in poll.select():
   if key.fileobj==0:
    data=os.read(0,65536)
    if not data: s.shutdown(socket.SHUT_WR);poll.unregister(0)
    else:s.sendall(data)
   else:
    data=s.recv(65536)
    if not data:raise SystemExit(0)
    view=memoryview(data)
    while view:view=view[os.write(1,view):]
finally:s.close()
`;
}
function validatePlan(plan) {
  if (plan?.version !== 1 || !/^erp-identity-drill-[a-f0-9]{20}$/.test(plan.name || '') ||
      plan.serverName !== plan.name + '-server' || !Array.isArray(plan.volumes) ||
      JSON.stringify(plan.volumes) !== JSON.stringify([0, 1, 2].map(i => `${plan.name}-files-${i}`))) {
    throw new Error('Invalid isolated recovery cleanup plan');
  }
  return plan;
}
function validateCutoff(cutoff, now = Date.now()) {
  if (!Number.isFinite(cutoff) || cutoff <= now || cutoff - now > maximumWindowMs)
    throw new Error('Operator window must expire within 30 minutes');
}
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000,
    maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Private recovery Docker operation failed; diagnostics withheld');
  return result.stdout;
}
function cleanup(plan, run = docker) {
  validatePlan(plan);
  const failed = [];
  for (const name of [plan.serverName, plan.name]) {
    try {
      if (!run(['ps', '-aq', '--filter', `name=^/${name}$`]).trim()) continue;
      const current = JSON.parse(run(['inspect', name]))[0];
      if (current.Config.Labels?.['erp.identity.drill'] !== plan.name) throw new Error('Ownership changed');
      run(['rm', '-f', '-v', name]);
    } catch { failed.push(name); }
  }
  for (const volume of plan.volumes) {
    try {
      if (!run(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim()) continue;
      const current = JSON.parse(run(['volume', 'inspect', volume]))[0];
      if (current.Labels?.['erp.identity.drill'] !== plan.name) throw new Error('Ownership changed');
      run(['volume', 'rm', volume]);
    } catch { failed.push(volume); }
  }
  if (failed.length) throw new Error('Owned isolated recovery cleanup incomplete');
}
function createRelay({ serverName, cutoff, spawnBridge = () => spawn('docker',
  ['exec', '-i', serverName, 'python', '-c', bridgeScriptForPort(9000)],
  { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }) }) {
  if (!/^erp-identity-drill-[a-f0-9]{20}-server$/.test(serverName || ''))
    throw new Error('Relay requires an invocation-owned restored server');
  validateCutoff(cutoff);
  const connections = new Map();
  let stopped = false;
  const server = net.createServer({ allowHalfOpen: true }, socket => {
    if (stopped || Date.now() >= cutoff || connections.size >= 24) { socket.destroy(); return; }
    let child;
    try { child = spawnBridge(); } catch { socket.destroy(); return; }
    connections.set(socket, child);
    socket.setTimeout(120000, () => socket.destroy());
    socket.on('error', () => socket.destroy());
    child.on('error', () => socket.destroy());
    // SSH stdin EOF may only close the request direction. Keep the response
    // direction alive, and wait for stdio closure rather than process exit so
    // buffered response bytes are not truncated.
    child.once('close', () => { if (!socket.writableEnded) socket.end(); });
    child.stdin.on('error', () => socket.destroy());
    child.stdout.on('error', () => socket.destroy());
    socket.once('close', () => { connections.delete(socket); child.kill('SIGTERM'); });
    socket.pipe(child.stdin);
    child.stdout.pipe(socket);
  });
  function stop() {
    if (stopped) return;
    stopped = true; clearTimeout(timer);
    server.close();
    for (const [socket, child] of connections) { socket.destroy(); child.kill('SIGTERM'); }
  }
  const timer = setTimeout(stop, cutoff - Date.now());
  timer.unref();
  server.on('error', stop);
  return { server, stop };
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
async function main(args = process.argv.slice(2)) {
  if (args[0] === 'cleanup') {
    const file = args[1];
    if (!file || !path.isAbsolute(file) || fs.statSync(file).size > 8192)
      throw new Error('Invalid private cleanup plan path');
    cleanup(JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log('OWNED_RECOVERY_RESOURCES_REMOVED');
    return;
  }
  const [mode, archivePath, expectedHash, expectedProject, directory] = args;
  if (mode !== 'serve' || !/^[a-f0-9]{64}$/.test(expectedHash || '') ||
      !/^[a-z0-9][a-z0-9_-]{1,62}$/.test(expectedProject || '') ||
      !directory || !path.isAbsolute(directory) || process.platform !== 'linux' || process.getuid() !== 0)
    throw new Error('Explicit source archive checksum, project and new private Linux window directory required');
  if (fs.realpathSync(path.dirname(directory)) !== path.dirname(directory))
    throw new Error('Refusing redirected window directory');
  if (require('node:os').freemem() < 3 * 1024 ** 3) throw new Error('At least 3 GiB available memory required');
  const source = loadRecoveryArchive(archivePath, process.env.IDENTITY_BACKUP_KEY_FILE);
  if (source.archiveHash !== expectedHash || source.bundle.project !== expectedProject || !source.manifestPresent)
    throw new Error('Recovery source does not match the approved archive and manifest');
  fs.mkdirSync(directory, { mode: 0o700 });
  let plan, relay, cancelled = false, completed = false;
  const cancel = () => { cancelled = true; relay?.stop(); };
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    const report = await drill(source.bundle, source.archiveHash, {
      beforeResources: async resources => {
        if (cancelled) throw new Error('Operator window cancelled before restore');
        plan = validatePlan({ version: 1, ...resources });
        const file = path.join(directory, 'cleanup-plan.json');
        writeJson(file, plan);
        const scheduled = spawnSync('systemd-run', ['--quiet', '--unit', plan.name + '-cleanup',
          '--on-active=45m', '--timer-property=AccuracySec=1s', process.execPath, __filename, 'cleanup', file],
        { timeout: 15000, encoding: 'utf8' });
        if (scheduled.error || scheduled.status !== 0) throw new Error('Independent cleanup watchdog could not be scheduled');
      },
      serve: async ({ serverName }) => {
        if (cancelled) throw new Error('Operator window cancelled before access');
        const cutoff = Date.now() + maximumWindowMs;
        relay = createRelay({ serverName, cutoff });
        const closed = new Promise(resolve => relay.server.once('close', resolve));
        await new Promise((resolve, reject) => {
          relay.server.once('error', reject);
          relay.server.listen(loopbackPort, '127.0.0.1', resolve);
        });
        writeJson(path.join(directory, 'ready.json'), {
          preparedAt: new Date().toISOString(), expiresAt: new Date(cutoff).toISOString(),
          sourceProject: expectedProject, archiveSha256: source.archiveHash,
          name: plan.name, serverName, loopbackHost: '127.0.0.1', loopbackPort,
          databaseSchemaAndDataMatched: true, volumesMatched: 3,
          sourceDatabaseOverwritten: false, restoredWorkerStarted: false,
          containerNetwork: 'none (shared restored database namespace)', publishedContainerPorts: 0,
          publicAccessEnabled: false, operatorLoginAccepted: false, credentialsInspected: false,
        });
        console.log('ISOLATED_RESTORED_IDENTITY_READY expires=' + new Date(cutoff).toISOString());
        await closed;
      },
    });
    writeJson(path.join(directory, 'closed.json'), { ...report, disposableResourcesRemoved: true });
    completed = true;
    console.log('ISOLATED_RESTORED_IDENTITY_WINDOW_CLOSED_AND_CLEANED');
  } finally {
    relay?.stop();
    if (plan) {
      // Also reconcile unknown Docker outcomes by exact name and ownership.
      cleanup(plan);
      if (completed) spawnSync('systemctl', ['stop', plan.name + '-cleanup.timer'], { timeout: 15000 });
    }
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  }
}
module.exports = { validatePlan, validateCutoff, cleanup, createRelay, bridgeScriptForPort, maximumWindowMs, loopbackPort, main };
if (require.main === module) main().catch(() => {
  console.error('ISOLATED_OPERATOR_WINDOW_FAILED; private credentials and diagnostics withheld; inspect owned cleanup plan');
  process.exitCode = 1;
});
