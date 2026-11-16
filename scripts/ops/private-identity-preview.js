'use strict';

// Temporary Cloud Shell HTTPS preview only; never a public identity reverse proxy.
const http = require('node:http');
const net = require('node:net');

function validateWindow(host, cutoff, now = Date.now()) {
  if (!/^8082-cs-[a-z0-9-]+\.cs-[a-z0-9-]+\.cloudshell\.dev$/.test(host)) {
    throw new Error('Expected the current Cloud Shell port-8082 preview hostname');
  }
  if (!Number.isFinite(cutoff) || cutoff <= now || cutoff - now > 30 * 60 * 1000) {
    throw new Error('A future cutoff no more than 30 minutes away is required');
  }
}

function createPreview({ host, cutoff, upstreamPort = 8080, upstreamTimeoutMs = 120000 }) {
  validateWindow(host, cutoff);
  // Blueprint/application creation may commit before a slow response returns.
  // Keep a bounded wait without ever extending the approved window's hard cutoff.
  if (!Number.isInteger(upstreamTimeoutMs) || upstreamTimeoutMs < 1 || upstreamTimeoutMs > 120000) {
    throw new Error('Upstream timeout must be an integer between 1 and 120000 milliseconds');
  }
  const sockets = new Set();
  let expired = false;
  function track(socket) {
    // Keep-alive reuses sockets across requests; register cleanup only once.
    if (sockets.has(socket)) return socket;
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    return socket;
  }
  function permitted(req) {
    return !expired && Date.now() < cutoff && req.url.startsWith('/') &&
      !req.url.startsWith('//') &&
      [host, '127.0.0.1:8082', 'localhost:8082'].includes(req.headers.host) &&
      (!req.headers.origin || req.headers.origin === 'https://' + host);
  }
  function headers(req) {
    const result = { ...req.headers };
    // Ignore any caller-supplied proxy identity, including duplicate conventions.
    for (const name of Object.keys(result)) {
      if (name.startsWith('x-forwarded-') || ['forwarded', 'x-real-ip',
        'proxy-authorization', 'proxy-connection'].includes(name)) delete result[name];
    }
    return { ...result, host, 'x-forwarded-host': host, 'x-forwarded-proto': 'https',
      'x-forwarded-port': '443', 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1' };
  }
  const server = http.createServer({ maxHeaderSize: 32768 }, (req, res) => {
    if (!permitted(req)) { res.writeHead(403); res.end(); return; }
    if (Number(req.headers['content-length'] || 0) > 2 * 1024 * 1024) {
      res.writeHead(413); res.end(); return;
    }
    function failed(status, detail) {
      if (res.writableEnded || res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store' });
      res.end(JSON.stringify({ detail }));
    }
    const proxy = http.request({ host: '127.0.0.1', port: upstreamPort,
      path: req.url, method: req.method, headers: headers(req), timeout: upstreamTimeoutMs }, upstream => {
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
    });
    proxy.on('socket', track);
    proxy.on('timeout', () => {
      failed(504, 'The private setup link timed out. The operation may have completed. Check the saved state before retrying a change.');
      proxy.destroy();
    });
    proxy.on('error', () => {
      failed(502, 'The private setup link was interrupted. The operation outcome is unknown. Check the saved state before retrying a change.');
    });
    req.on('aborted', () => proxy.destroy());
    res.on('close', () => proxy.destroy());
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        proxy.destroy();
        if (!res.headersSent) { res.writeHead(413); res.end(); } else res.destroy();
        req.destroy();
      }
    });
    req.pipe(proxy);
  });
  server.on('connection', track);
  server.on('upgrade', (req, socket, head) => {
    if (!permitted(req) || req.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    const upstream = track(net.connect({ host: '127.0.0.1', port: upstreamPort }));
    upstream.setTimeout(30000, () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('close', () => socket.destroy());
    upstream.once('connect', () => {
      const lines = Object.entries(headers(req)).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map(item => name + ': ' + item));
      upstream.write(req.method + ' ' + req.url + ' HTTP/1.1\r\n' + lines.join('\r\n') + '\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  function stop() {
    expired = true;
    clearTimeout(timer);
    server.close();
    for (const socket of sockets) socket.destroy();
  }
  const timer = setTimeout(stop, cutoff - Date.now());
  timer.unref();
  server.once('close', () => clearTimeout(timer));
  return { server, stop };
}

function main(args = process.argv.slice(2)) {
  try {
    const host = args[0];
    const cutoff = Date.parse(args[1]);
    const preview = createPreview({ host, cutoff });
    process.once('SIGINT', preview.stop);
    process.once('SIGTERM', preview.stop);
    preview.server.once('error', () => { preview.stop(); process.exitCode = 1; });
    preview.server.listen(8082, '127.0.0.1', () => {
      // Never log requests, credentials, cookies, tokens, or response contents.
      process.stdout.write('PRIVATE_RECOVERY_PREVIEW_READY expires=' + new Date(cutoff).toISOString() + '\n');
    });
  } catch (error) {
    process.stderr.write(error.message + '\n'); process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { createPreview, validateWindow, main };
