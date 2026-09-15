import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

async function portIsInUse() {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 3000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

if (await portIsInUse()) {
  console.error('Port 3000 is already in use. Stop the existing local demo, then run npm start again.');
  process.exit(1);
}

const next = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', '3000'], {
  stdio: 'inherit',
});

let stopping = false;
const stop = (signal) => {
  stopping = true;
  server.kill(signal);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch('http://127.0.0.1:3000/login')).ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('The local server did not become ready within 30 seconds.');
}

try {
  await waitForServer();
  await import('./local-smoke.mjs');
  console.log('Open http://127.0.0.1:3000 — the local evaluation workspace is ready.');
} catch (error) {
  console.error(`Local demo startup check failed: ${error instanceof Error ? error.message : error}`);
  stop('SIGTERM');
  process.exitCode = 1;
}

server.on('exit', (code, signal) => {
  if (stopping && process.exitCode === undefined) process.exitCode = 0;
  else if (code !== 0 && process.exitCode === undefined) process.exitCode = 1;
  if (signal && !stopping) process.exitCode = 1;
});
