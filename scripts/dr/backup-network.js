const dns = require('node:dns/promises');

function transientFailure(error) {
  if (['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'P1001', 'P1002', 'P1017'].includes(error?.code)) return true;
  return /could not translate host name|temporary failure in name resolution|connection timed out|server closed the connection unexpectedly|connection reset by peer|network is unreachable/i.test(error?.diagnostic || '');
}

async function withNetworkRetry(work, { attempts = 3, pause = (ms) => new Promise(resolve => setTimeout(resolve, ms)), onRetry = () => {} } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await work(attempt); }
    catch (error) {
      if (attempt + 1 === attempts || !transientFailure(error)) throw error;
      onRetry(attempt + 1);
      await pause(2000 * 2 ** attempt);
    }
  }
}

async function resolveAddress(hostname, attempt = 0, lookup = dns.lookup) {
  let timer;
  try {
    const addresses = await Promise.race([
      lookup(hostname, { family: 4, all: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Host lookup timed out'), { code: 'ETIMEDOUT' })), 15000); }),
    ]);
    if (!addresses.length) throw Object.assign(new Error('Host has no IPv4 address'), { code: 'EAI_AGAIN' });
    return addresses[attempt % addresses.length].address;
  } finally { clearTimeout(timer); }
}

function pgEnvironment(url, address) {
  const neon = url.hostname.endsWith('.neon.tech');
  return {
    ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: neon ? 'verify-full' : 'prefer',
    // Preserve hostname verification and SNI; only bypass Docker's DNS lookup.
    PGHOSTADDR: address || '', PGSSLROOTCERT: neon ? '/etc/ssl/certs/ca-certificates.crt' : '',
    PGCONNECT_TIMEOUT: '20', PGOPTIONS: '-c timezone=UTC',
  };
}
module.exports = { transientFailure, withNetworkRetry, resolveAddress, pgEnvironment };
