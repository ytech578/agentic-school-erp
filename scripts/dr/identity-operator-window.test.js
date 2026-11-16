const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { EventEmitter, once } = require('node:events');
const { PassThrough } = require('node:stream');
const { validatePlan, validateCutoff, cleanup, createRelay, bridgeScriptForPort } = require('./identity-operator-window');
const name = 'erp-identity-drill-' + 'a'.repeat(20);
const plan = () => ({ version: 1, name, serverName: name + '-server',
  volumes: [0, 1, 2].map(i => `${name}-files-${i}`) });
test('forced stdio relay accepts only a numeric loopback destination, never command fragments', () => {
  assert.ok(bridgeScriptForPort(28082).includes("('127.0.0.1',28082)"));
  assert.ok(bridgeScriptForPort(9000).includes("('127.0.0.1',9000)"));
  for (const port of ['28082', '28082);import os', 0, -1, 65536, NaN, Infinity])
    assert.throws(() => bridgeScriptForPort(port));
});
test('operator cleanup cannot target source names, unknown mounts or mixed invocations', () => {
  assert.deepEqual(validatePlan(plan()), plan());
  for (const changed of [
    { name: 'school-erp-staging' }, { serverName: 'school-erp-staging-server-1' },
    { volumes: ['/data', '/templates', '/certs'] }, { volumes: [name + '-files-0'] },
    { volumes: [...plan().volumes].reverse() }, { version: 2 },
  ]) assert.throws(() => validatePlan({ ...plan(), ...changed }));
});
test('operator access has a hard maximum 30-minute cutoff', () => {
  assert.doesNotThrow(() => validateCutoff(1800001, 1));
  for (const cutoff of [0, 1, Infinity, NaN, 1800002]) assert.throws(() => validateCutoff(cutoff, 1));
  assert.throws(() => createRelay({ serverName: 'school-erp-staging-server-1', cutoff: Date.now() + 1000 }));
});
test('watchdog removes only exact invocation-owned resources and tolerates absent resources', () => {
  const calls = [];
  const run = args => {
    calls.push(args);
    if (args[0] === 'ps' || args[0] === 'volume' && args[1] === 'ls') return 'synthetic-id\n';
    if (args[0] === 'inspect') return JSON.stringify([{ Config: { Labels: { 'erp.identity.drill': name } } }]);
    if (args[0] === 'volume' && args[1] === 'inspect') return JSON.stringify([{ Labels: { 'erp.identity.drill': name } }]);
    return '';
  };
  cleanup(plan(), run);
  assert.equal(calls.filter(c => c[0] === 'rm').length, 2);
  assert.equal(calls.filter(c => c[0] === 'volume' && c[1] === 'rm').length, 3);
  assert.ok(calls.filter(c => c.includes('rm')).every(c => c.at(-1).startsWith(name)));
  assert.doesNotThrow(() => cleanup(plan(), () => ''));
});
test('watchdog refuses changed ownership rather than removing foreign resources', () => {
  const removed = [];
  assert.throws(() => cleanup(plan(), args => {
    if (args.includes('rm')) removed.push(args);
    if (args[0] === 'ps' || args[0] === 'volume' && args[1] === 'ls') return 'synthetic-id';
    if (args[0] === 'inspect') return JSON.stringify([{ Config: { Labels: { 'erp.identity.drill': 'another-invocation' } } }]);
    if (args[0] === 'volume' && args[1] === 'inspect') return JSON.stringify([{ Labels: {} }]);
    return '';
  }), /cleanup incomplete/);
  assert.deepEqual(removed, []);
});
test('private relay forwards opaque streams without reading credentials and closes active access at expiry', async t => {
  let started = 0, killed = 0;
  const relay = createRelay({ serverName: name + '-server', cutoff: Date.now() + 800,
    spawnBridge: () => {
      started++;
      const child = new EventEmitter();
      child.stdin = new PassThrough(); child.stdout = child.stdin;
      child.kill = () => { killed++; child.stdin.destroy(); };
      return child;
    } });
  t.after(relay.stop);
  await new Promise((resolve, reject) => {
    relay.server.once('error', reject); relay.server.listen(0, '127.0.0.1', resolve);
  });
  assert.equal(relay.server.address().address, '127.0.0.1');
  const client = net.connect({ host: '127.0.0.1', port: relay.server.address().port });
  t.after(() => client.destroy());
  await once(client, 'connect');
  const data = once(client, 'data');
  client.write('synthetic-loopback-payload');
  assert.equal((await data)[0].toString(), 'synthetic-loopback-payload');
  assert.equal(started, 1);
  await once(client, 'close');
  assert.equal(relay.server.listening, false);
  assert.ok(killed >= 1);
});
test('relay preserves delayed response bytes after a client request half-close', async t => {
  const relay = createRelay({ serverName: name + '-server', cutoff: Date.now() + 5000,
    spawnBridge: () => {
      const child = new EventEmitter();
      child.stdin = new PassThrough(); child.stdout = new PassThrough();
      const request = [];
      child.stdin.on('data', data => request.push(data));
      child.stdin.once('end', () => setTimeout(() => {
        child.stdout.end(Buffer.concat(request));
        child.emit('exit', 0);
        setImmediate(() => child.emit('close', 0));
      }, 25));
      child.kill = () => { child.stdin.destroy(); child.stdout.destroy(); };
      return child;
    } });
  t.after(relay.stop);
  await new Promise((resolve, reject) => {
    relay.server.once('error', reject); relay.server.listen(0, '127.0.0.1', resolve);
  });
  const client = net.connect({ host: '127.0.0.1', port: relay.server.address().port });
  t.after(() => client.destroy());
  const response = [];
  client.on('data', bytes => response.push(bytes));
  await once(client, 'connect');
  const closed = once(client, 'close');
  client.end('synthetic-response-after-request-eof');
  await closed;
  assert.equal(Buffer.concat(response).toString(), 'synthetic-response-after-request-eof');
});
