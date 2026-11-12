// scripts/dev-electron.mjs
//
// Third leg of `npm run dev:desktop`: waits for the Vite dev server and the
// API server (both started by concurrently, exactly as in `npm run dev`),
// then opens the Electron window pointed at Vite. No extra dependencies —
// just fetch-and-retry.
//
// Note the Electron window in dev mode does NOT embed the server; it's a pure
// viewer, so better-sqlite3 keeps its plain-Node build and `npm run dev`
// stays untouched.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Importing the 'electron' package from Node yields the path to the binary.
const electronPath = require('electron');

const VITE_URL = process.env.EXLIBRIS_DEV_SERVER_URL || 'http://localhost:5173';
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';

async function waitFor(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(url);
      return; // any HTTP response means the listener is up
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${label} at ${url}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

try {
  await Promise.all([
    waitFor(VITE_URL, 'the Vite dev server'),
    waitFor(`${API_URL}/api/settings/ai`, 'the API server'),
  ]);
} catch (error) {
  console.error(`[dev-electron] ${error.message}`);
  process.exit(1);
}

console.log(`[dev-electron] Opening Electron against ${VITE_URL}`);
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, EXLIBRIS_DEV_SERVER_URL: VITE_URL },
});

// Propagate the exit so `concurrently -k` tears down Vite and the API server
// when the window is closed.
child.on('exit', (code) => process.exit(code ?? 0));
