// server/paths.js
//
// Where Ex Libris keeps its mutable state: the SQLite database and the
// `.secret` file that encrypts the stored API key. Historically both lived
// next to the server code inside the repo; now they live in a per-user app
// data directory so the repo stays clean and a packaged desktop build has a
// writable home.
//
// Resolution order:
//   1. EXLIBRIS_DATA_DIR   — set explicitly (the Electron shell points this
//                            at app.getPath('userData')), or by you.
//   2. A platform default that matches Electron's userData for the same app
//      name, so `npm run dev` and the desktop app share one library:
//        Windows  %APPDATA%\Ex Libris
//        macOS    ~/Library/Application Support/Ex Libris
//        Linux    $XDG_CONFIG_HOME/Ex Libris or ~/.config/Ex Libris

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR_NAME = 'Ex Libris';

function defaultDataDir() {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        APP_DIR_NAME
      );
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', APP_DIR_NAME);
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
        APP_DIR_NAME
      );
  }
}

export const DATA_DIR = process.env.EXLIBRIS_DATA_DIR || defaultDataDir();
fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'exlibris.db');
export const SECRET_PATH = path.join(DATA_DIR, '.secret');

// ---------------------------------------------------------------------------
// One-time migration from the repo-era locations (server/exlibris.db and
// server/.secret). Copy, don't move: if anything goes wrong mid-upgrade the
// originals are still intact. Once the new copy exists we never look back.
// ---------------------------------------------------------------------------
function copyIfMissing(from, to, mode) {
  if (!fs.existsSync(from) || fs.existsSync(to)) return false;
  fs.copyFileSync(from, to);
  if (mode !== undefined) {
    try {
      fs.chmodSync(to, mode);
    } catch {
      /* non-POSIX filesystem */
    }
  }
  return true;
}

try {
  const legacyDb = path.join(__dirname, 'exlibris.db');
  if (copyIfMissing(legacyDb, DB_PATH)) {
    // WAL sidecars carry unflushed writes — they must travel with the db.
    copyIfMissing(`${legacyDb}-wal`, `${DB_PATH}-wal`);
    copyIfMissing(`${legacyDb}-shm`, `${DB_PATH}-shm`);
    console.log(
      `[exlibris] Copied your library from ${legacyDb} to ${DB_PATH}. ` +
        'The repo copy is no longer used; delete it when you are confident.'
    );
  }
  if (copyIfMissing(path.join(__dirname, '.secret'), SECRET_PATH, 0o600)) {
    console.log(`[exlibris] Copied server/.secret to ${SECRET_PATH}.`);
  }
} catch (error) {
  // Packaged builds have a read-only, possibly virtual server/ directory and
  // nothing to migrate; a failed probe there must never block startup.
  console.warn('[exlibris] Legacy data migration skipped:', error.message);
}
