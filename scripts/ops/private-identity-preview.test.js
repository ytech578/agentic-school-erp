const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const { createPreview, validateWindow } = require('./private-identity-preview');
const host = '8082-cs-test-session.cs-asia-southeast1-palm.cloudshell.dev';
async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port;
}
function request(port, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: options.path || '/',
      method: options.method || 'GET', agent: options.agent, headers: { host, ...options.headers } }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end(options.body);
  });
}
test('preview refuses other hosts, expired windows and unbounded access', () => {
  assert.doesNotThrow(() => validateWindow(host, 1010, 1000));
  for (const value of [999, 1000, 1801001, NaN]) assert.throws(() => validateWindow(host, value, 1000));
  for (const value of ['example.com', '8080-cs-test.cs-region.cloudshell.dev', host + '.evil.test']) {
    assert.throws(() => validateWindow(value, 1010, 1000));
  }
});

test('upstream waits cannot be disabled or made unbounded', () => {
  for (const upstreamTimeoutMs of [0, -1, NaN, Infinity, 120001, 1.5, '120000']) {
    assert.throws(() => createPreview({ host, cutoff: Date.now() + 10000, upstreamTimeoutMs }), /Upstream timeout/);
  }
});

test('slow committed writes get an unknown-outcome timeout, not a blind-retry failure', async t => {
  let writes = 0;
  const timers = new Set();
  const upstream = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      writes++;
      const timer = setTimeout(() => { timers.delete(timer); res.end('saved'); }, 100);
      timers.add(timer);
    });
  });
  t.after(() => { for (const timer of timers) clearTimeout(timer); upstream.closeAllConnections(); upstream.close(); });
  const upstreamPort = await listen(upstream);
  const short = createPreview({ host, cutoff: Date.now() + 10000, upstreamPort, upstreamTimeoutMs: 25 });
  t.after(short.stop);
  const timedOut = await request(await listen(short.server), { method: 'PUT', body: 'synthetic-operation' });
  assert.equal(timedOut.status, 504);
  assert.equal(timedOut.headers['cache-control'], 'no-store');
  assert.match(JSON.parse(timedOut.body).detail, /may have completed.*before retrying/);
  assert.equal(writes, 1, 'A lost response must not cause an automatic retry');

  const longer = createPreview({ host, cutoff: Date.now() + 10000, upstreamPort, upstreamTimeoutMs: 1000 });
  t.after(longer.stop);
  const completed = await request(await listen(longer.server), { method: 'PUT', body: 'synthetic-operation' });
  assert.equal(completed.status, 200);
  assert.equal(completed.body, 'saved');
  assert.equal(writes, 2);
});

test('a longer upstream wait never outlives the approved window', async t => {
  const upstream = http.createServer(req => req.resume());
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const upstreamPort = await listen(upstream);
  const preview = createPreview({ host, cutoff: Date.now() + 300, upstreamPort, upstreamTimeoutMs: 1000 });
  t.after(preview.stop);
  const port = await listen(preview.server);
  await assert.rejects(request(port, { method: 'PUT', body: 'synthetic-operation' }), /socket hang up|ECONNRESET/);
  assert.equal(preview.server.listening, false);
});

test('an interrupted upstream returns a non-cacheable reconciliation warning', async t => {
  const upstream = http.createServer(req => req.socket.destroy());
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const upstreamPort = await listen(upstream);
  const preview = createPreview({ host, cutoff: Date.now() + 10000, upstreamPort });
  t.after(preview.stop);
  const result = await request(await listen(preview.server), { method: 'PUT', body: 'synthetic-operation' });
  assert.equal(result.status, 502);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.match(JSON.parse(result.body).detail, /outcome is unknown.*before retrying/);
});
test('preview preserves cookies and bodies, overwrites proxy headers and rejects foreign origins', async t => {
  let received;
  const upstream = http.createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received = { headers: req.headers, body, method: req.method, url: req.url };
      res.setHeader('Set-Cookie', ['session=fixture; Secure; HttpOnly', 'csrf=fixture; Secure']); res.end('ok');
    });
  });
  t.after(() => upstream.close());
  const upstreamPort = await listen(upstream);
  const preview = createPreview({ host, cutoff: Date.now() + 10000, upstreamPort });
  t.after(preview.stop);
  const port = await listen(preview.server);
  const result = await request(port, { method: 'POST', path: '/flow/?x=1', body: 'fixture', headers: {
    origin: 'https://' + host, cookie: 'csrf=fixture', 'x-forwarded-proto': 'http',
    forwarded: 'host=evil.test', 'proxy-authorization': 'fixture', 'x-forwarded-other': 'evil' } });
  assert.equal(result.status, 200); assert.equal(result.headers['set-cookie'].length, 2);
  assert.equal(received.body, 'fixture'); assert.equal(received.url, '/flow/?x=1');
  assert.equal(received.headers.cookie, 'csrf=fixture');
  assert.equal(received.headers['x-forwarded-proto'], 'https'); assert.equal(received.headers.host, host);
  for (const name of ['forwarded', 'proxy-authorization', 'x-forwarded-other']) assert.equal(received.headers[name], undefined);
  assert.equal((await request(port, { headers: { origin: 'https://evil.test' } })).status, 403);
  assert.equal((await request(port, { headers: { host: 'evil.test' } })).status, 403);
  assert.equal((await request(port, { path: '//evil.test/' })).status, 403);
  assert.equal((await request(port, { headers: { 'content-length': '2097153' } })).status, 413);
});
test('preview supports WebSocket upgrade and hard cutoff closes active sockets', async t => {
  let forwarded;
  const upstream = http.createServer();
  upstream.on('upgrade', (req, socket) => {
    forwarded = req.headers;
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  });
  t.after(() => upstream.close());
  const upstreamPort = await listen(upstream);
  const preview = createPreview({ host, cutoff: Date.now() + 800, upstreamPort });
  t.after(preview.stop);
  const port = await listen(preview.server);
  const socket = net.connect(port, '127.0.0.1'); t.after(() => socket.destroy());
  await once(socket, 'connect');
  socket.write('GET /ws/client/ HTTP/1.1\r\nHost: ' + host + '\r\nOrigin: https://' + host + '\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  const [data] = await once(socket, 'data'); assert.match(data.toString(), /101 Switching/);
  assert.equal(forwarded['x-forwarded-proto'], 'https');
  await once(socket, 'close'); assert.equal(preview.server.listening, false);
});

test('reused upstream keep-alive sockets do not accumulate tracking listeners', async t => {
  const warnings = [];
  const onWarning = warning => {
    if (warning.name === 'MaxListenersExceededWarning') warnings.push(warning);
  };
  process.on('warning', onWarning);
  t.after(() => process.off('warning', onWarning));
  const upstreamSockets = new Set();
  const upstream = http.createServer((req, res) => {
    upstreamSockets.add(req.socket); res.end('ok');
  });
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const upstreamPort = await listen(upstream);
  const preview = createPreview({ host, cutoff: Date.now() + 10000, upstreamPort });
  t.after(preview.stop);
  const port = await listen(preview.server);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  t.after(() => agent.destroy());
  for (let index = 0; index < 25; index++) {
    assert.equal((await request(port, { agent })).status, 200);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(upstreamSockets.size < 25, 'The test must exercise upstream socket reuse');
  assert.equal(warnings.length, 0, 'Repeated requests must not add duplicate socket close listeners');
});
