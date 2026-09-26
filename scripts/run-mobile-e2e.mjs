import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', '5191', '--strictPort'], {
  cwd: resolve(root, 'frontend'),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-3000); });
}

async function esperarServidor() {
  for (let tentativa = 0; tentativa < 150; tentativa++) {
    if (server.exitCode !== null) throw new Error(`Vite encerrou antes dos testes. ${serverOutput}`);
    try {
      const response = await fetch('http://localhost:5191/', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // Vite ainda está iniciando.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Vite não iniciou em 15 segundos. ${serverOutput}`);
}

try {
  await esperarServidor();
  const tests = spawn(process.execPath, [resolve(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.mobile.config.ts'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  const code = await new Promise((resolveExit) => tests.on('close', resolveExit));
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill();
}
