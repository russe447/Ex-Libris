// electron/main.cjs
//
// The desktop shell. Deliberately thin: it owns one BrowserWindow and the
// lifecycle of the existing Express server — nothing else. The React app and
// the API are exactly the same code that `npm run dev` uses.
//
// Two modes, decided by EXLIBRIS_DEV_SERVER_URL:
//
//   dev      `npm run dev:desktop` runs Vite and the API server as plain Node
//            processes (same as `npm run dev`) and this window just points at
//            the Vite dev server. Hot reload works; better-sqlite3 stays
//            compiled for your system Node.
//
//   packaged The Express server is imported *into this process*, bound to a
//            free loopback port, told to also serve the built UI from dist/,
//            and the window loads http://127.0.0.1:<port>. One process,
//            one origin, no CORS. Closing the window quits the app, which
//            closes the HTTP listener and the SQLite handle cleanly.
//
// CommonJS on purpose: package.json says `"type": "module"` for the repo, but
// the .cjs extension keeps Electron's main entry simple, and the ESM server
// is pulled in with a dynamic import().

const { app, BrowserWindow, dialog, shell } = require('electron');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { installMenu } = require('./menu.cjs');

const DEV_SERVER_URL = process.env.EXLIBRIS_DEV_SERVER_URL || '';
const isDev = Boolean(DEV_SERVER_URL);

// Stable name => stable userData path ("Ex Libris" under the platform's app
// data root). server/paths.js derives the same path when the server runs
// outside Electron, so dev and desktop share one library.
app.setName('Ex Libris');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('http').Server | null} */
let httpServer = null;
/** @type {import('better-sqlite3').Database | null} */
let database = null;

// A second launch should focus the existing window, not spawn a second server
// against the same SQLite file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(start);
}

async function start() {
  try {
    const url = isDev ? DEV_SERVER_URL : await startEmbeddedServer();
    createWindow(url);
  } catch (error) {
    console.error('[exlibris] Fatal startup error:', error);
    dialog.showErrorBox(
      'Ex Libris could not start',
      `The local server failed to start.\n\n${error.stack || error.message || error}`
    );
    app.quit();
  }
}

/**
 * Ask the OS for a free loopback port so we never collide with a dev server,
 * another app, or a second user on the machine.
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Boot the existing Express server inside this process and return the URL the
 * window should load. Environment is set *before* the import because the
 * server resolves its data directory and static mode at module load.
 */
async function startEmbeddedServer() {
  // Database + .secret live in the per-user app data directory.
  process.env.EXLIBRIS_DATA_DIR = process.env.EXLIBRIS_DATA_DIR || app.getPath('userData');
  // Serve the built UI from the same origin as the API.
  process.env.EXLIBRIS_STATIC_DIR = path.join(__dirname, '..', 'dist');

  const port = await getFreePort();
  const serverDir = path.join(__dirname, '..', 'server');
  const { startServer } = await import(pathToFileURL(path.join(serverDir, 'index.js')).href);
  httpServer = await startServer(port);

  // Keep a handle on the SQLite connection so quitting can close it and let
  // WAL checkpoint to the main db file.
  database = (await import(pathToFileURL(path.join(serverDir, 'database.js')).href)).default;

  return `http://127.0.0.1:${port}`;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false, // avoid a white flash; shown on ready-to-show below
    backgroundColor: '#1a1814', // matches the app's dark parchment theme
    title: 'Ex Libris',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Native application menu; app-level items round-trip through the renderer.
  installMenu(mainWindow);
  // Exports arrive as blob <a download> links from the renderer. Make sure
  // every platform gets a real save dialog, keeps the suggested filename
  // (e.g. "My Novel.docx"), and starts in the user's Downloads folder.
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      title: 'Save Export',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    });
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // The renderer is a web app: any link that tries to leave the app (or open
  // a new window) goes to the system browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    }
  });

  // In dev the window often races the Vite dev server; retry until it's up.
  if (isDev) {
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => mainWindow && mainWindow.loadURL(url), 500);
    });
  }

  mainWindow.loadURL(url);
}

// "One window" app: closing it quits everywhere, including macOS. A dock-
// resident lifetime (and a native menu) can come later.
app.on('window-all-closed', () => {
  app.quit();
});

// Shut the server down with the app so the port is released and SQLite's WAL
// is checkpointed into the main database file.
app.on('will-quit', () => {
  try {
    httpServer?.close();
  } catch (error) {
    console.error('[exlibris] Error closing server:', error);
  }
  try {
    database?.close();
  } catch (error) {
    console.error('[exlibris] Error closing database:', error);
  }
});
