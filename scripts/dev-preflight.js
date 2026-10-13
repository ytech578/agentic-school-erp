#!/usr/bin/env node
/**
 * Development Preflight Checker & Service Bootstrapper
 * ─────────────────────────────────────────────────────────────────────────────
 * Ensures required backing services (PostgreSQL & Redis) are ready before
 * launching API and Web dev servers.
 *
 * 1. Checks if PostgreSQL (5432) and Redis (6379) are listening.
 * 2. If already listening, exits immediately (zero startup overhead).
 * 3. If missing, attempts to launch them via Docker Compose / Docker Desktop.
 * 4. Exits cleanly so "npm run dev" always proceeds smoothly.
 */

const net = require('net');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const COMPOSE_FILE = path.join(ROOT_DIR, 'docker-compose.dev.yml');

function isPortOpen(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      isResolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

function runSilent(cmd, cwd = ROOT_DIR) {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8' });
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryStartDocker() {
  if (process.platform === 'win32') {
    const dockerExe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    if (fs.existsSync(dockerExe)) {
      console.log('ℹ  Starting Docker Desktop in the background...');
      const child = spawn(dockerExe, [], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Wait up to 20 seconds for docker daemon to become available
      process.stdout.write('⏳ Waiting for Docker daemon to initialize');
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        process.stdout.write('.');
        const info = runSilent('docker info');
        if (info && !info.includes('Server Errors')) {
          console.log('\n✔  Docker daemon is now ready!');
          return true;
        }
      }
      console.log('');
    }
  }
  return false;
}

async function startComposeServices() {
  console.log('ℹ  Starting backing services (PostgreSQL & Redis) via docker-compose...');
  
  // Try modern "docker compose" first, then legacy "docker-compose"
  let started = runSilent(`docker compose -f "${COMPOSE_FILE}" up -d`);
  if (!started) {
    started = runSilent(`docker-compose -f "${COMPOSE_FILE}" up -d`);
  }

  if (started) {
    console.log('✔  Containers launched. Waiting for services to accept connections...');
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const pg = await isPortOpen('127.0.0.1', 5432, 500);
      const rd = await isPortOpen('127.0.0.1', 6379, 500);
      if (pg && rd) {
        console.log('✔  PostgreSQL (5432) and Redis (6379) are online and healthy!');
        return true;
      }
    }
  }
  return false;
}

async function main() {
  const pgReady = await isPortOpen('127.0.0.1', 5432);
  const rdReady = await isPortOpen('127.0.0.1', 6379);

  if (pgReady && rdReady) {
    console.log('✔  PostgreSQL (5432) and Redis (6379) are active.');
    process.exit(0);
  }

  console.log('⚠️  Notice: Required backing services not detected:');
  if (!pgReady) console.log('   - PostgreSQL (port 5432): offline');
  if (!rdReady) console.log('   - Redis (port 6379): offline');

  // Check if Docker CLI is responsive
  let dockerOk = runSilent('docker ps');
  if (!dockerOk) {
    console.log('ℹ  Docker is not currently running.');
    const launched = await tryStartDocker();
    if (launched) {
      dockerOk = runSilent('docker ps');
    }
  }

  if (dockerOk) {
    await startComposeServices();
  } else {
    console.log('⚠️  Could not automatically launch Docker backing containers.');
    console.log('👉 Tip: Open Docker Desktop and run "npm run docker:dev" if full persistence is needed.');
    console.log('🚀 API will continue booting in resilient memory fallback mode where possible.\n');
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
