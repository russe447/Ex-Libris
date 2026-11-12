// electron/menu.cjs
//
// The native application menu. Deliberately thin: the menu owns nothing. Every
// app-level item just sends an action id to the renderer over IPC
// ('exlibris:menu-action'), and the existing stores do what they already do —
// the menu is a second keyboard, not a second UI.
//
// The renderer keeps the menu honest by pushing a small state snapshot the
// other way ('exlibris:menu-state'): which view is active, whether a novel is
// open, which theme is selected, and the theme list itself (so theme names are
// never duplicated here). Each push rebuilds the menu — menus are tiny and the
// pushes are rare (view/theme/novel changes, not keystrokes).
//
// Only Help (About, Shortcuts) is handled entirely in the main process, with
// native message boxes, so it needs no renderer UI at all.
//
// ── Accelerator policy ─────────────────────────────────────────────────────
// Menu accelerators consume the keystroke BEFORE the page sees it, so every
// accelerator here must avoid anything the web app already binds:
//
//   TipTap editor   Mod-b/i/u/e · Mod-Shift-s/b/e/l/r/j/7/8 · Mod-Alt-c/0-6
//                   Mod-z/y, Shift-Mod-z · Mod-Enter · Mod-a (ProseMirror)
//   Page itself     Ctrl/Cmd+\ (cycle views) · Ctrl/Cmd+F (find, mirrored
//                   here on purpose) · Esc
//
// plus OS-level traps: Ctrl+Alt+<letter> is AltGr on many European layouts
// (stealing it blocks typing € and friends), and Ctrl+Alt+arrows are GNOME
// workspace switching / legacy Intel display-rotation hotkeys. Hence:
// Export is Mod+P (not Mod+E = inline code), Sidebar is Mod+Shift+\ (not
// Mod+Shift+B = blockquote), and chapter navigation is Ctrl+PageUp/Down
// outside macOS. Mod+Z/Y are taken over deliberately — the renderer routes
// them to TipTap's history or native undo depending on focus.

const { app, dialog, ipcMain, Menu } = require('electron');

const isMac = process.platform === 'darwin';

/** @type {import('electron').BrowserWindow | null} */
let targetWindow = null;

/** What the renderer last told us. Safe defaults until the app has booted. */
let state = {
  view: 'write', // 'write' | 'focus' | 'outline'
  sidebarOpen: true,
  themeId: '',
  themes: /** @type {{ id: string, name: string }[]} */ ([]),
  hasNovel: false,
  hasChapter: false,
  hasPrevChapter: false,
  hasNextChapter: false,
  /** A create/delete is in flight — hold New Novel / New Chapter. */
  busy: false,
};

function send(actionId) {
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('exlibris:menu-action', actionId);
  }
}

/** Renderer input crosses a trust boundary: accept only the expected shape. */
function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const next = { ...state };
  if (['write', 'focus', 'outline'].includes(raw.view)) next.view = raw.view;
  for (const key of ['sidebarOpen', 'hasNovel', 'hasChapter', 'hasPrevChapter', 'hasNextChapter', 'busy']) {
    if (typeof raw[key] === 'boolean') next[key] = raw[key];
  }
  if (typeof raw.themeId === 'string' && raw.themeId.length <= 100) next.themeId = raw.themeId;
  if (Array.isArray(raw.themes) && raw.themes.length <= 50) {
    const themes = [];
    for (const entry of raw.themes) {
      if (
        entry &&
        typeof entry.id === 'string' &&
        entry.id.length <= 100 &&
        typeof entry.name === 'string' &&
        entry.name.length <= 100
      ) {
        themes.push({ id: entry.id, name: entry.name });
      }
    }
    next.themes = themes;
  }
  return next;
}

function themeSubmenu() {
  if (state.themes.length === 0) return [];
  return [
    { type: 'separator' },
    {
      label: 'Theme',
      submenu: state.themes.map((theme) => ({
        label: theme.name,
        type: 'radio',
        checked: theme.id === state.themeId,
        click: () => send(`view:theme:${theme.id}`),
      })),
    },
  ];
}

function buildTemplate() {
  const isDev = !app.isPackaged;
  return [
    // macOS puts About/Quit in the application menu; elsewhere they live in
    // File and Help.
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Novel',
          accelerator: 'CmdOrCtrl+Shift+N',
          enabled: !state.busy,
          click: () => send('file:new-novel'),
        },
        {
          label: 'New Chapter',
          accelerator: 'CmdOrCtrl+N',
          enabled: state.hasNovel && !state.busy,
          click: () => send('file:new-chapter'),
        },
        { type: 'separator' },
        {
          label: 'Export Manuscript…',
          // Not Mod+E (TipTap inline code). Mod+P fits the "print me a PDF"
          // reflex and is unclaimed; macOS's emacs-style Ctrl+P in text
          // fields is untouched because this binds Cmd+P there.
          accelerator: 'CmdOrCtrl+P',
          enabled: state.hasNovel,
          click: () => send('file:export'),
        },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        // Not roles: the renderer routes these to TipTap's own history when
        // the editor has focus (ProseMirror keeps its own undo stack), and
        // falls back to the native behaviour inside ordinary inputs.
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('edit:undo') },
        {
          label: 'Redo',
          accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y',
          click: () => send('edit:redo'),
        },
        { type: 'separator' },
        // Plain clipboard roles work everywhere, TipTap included.
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' }] : []),
        { role: 'selectAll' },
        { type: 'separator' },
        // Searches the whole novel via the Search panel — the page only ever
        // holds one chapter, so a browser-style find would quietly lie.
        { label: 'Find in Novel…', accelerator: 'CmdOrCtrl+F', click: () => send('edit:find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Manuscript',
          type: 'radio',
          checked: state.view === 'write',
          accelerator: 'CmdOrCtrl+1',
          click: () => send('view:manuscript'),
        },
        {
          label: 'Outline',
          type: 'radio',
          checked: state.view === 'outline',
          accelerator: 'CmdOrCtrl+2',
          click: () => send('view:outline'),
        },
        {
          label: 'Focus',
          type: 'radio',
          checked: state.view === 'focus',
          accelerator: 'CmdOrCtrl+3',
          click: () => send('view:focus'),
        },
        { type: 'separator' },
        {
          label: 'Sidebar',
          type: 'checkbox',
          checked: state.sidebarOpen,
          // Not Mod+B (bold) or Mod+Shift+B (blockquote). Shift+\ pairs
          // with the app's own Ctrl/Cmd+\ view cycling.
          accelerator: 'CmdOrCtrl+Shift+\\',
          click: () => send('view:toggle-sidebar'),
        },
        ...themeSubmenu(),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev
          ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }]
          : []),
      ],
    },
    {
      label: 'Novel',
      submenu: [
        // Ctrl+Alt+arrows are GNOME workspace switching (the OS eats them
        // before we ever see them) and legacy display-rotation hotkeys on
        // Windows, so outside macOS use the Ctrl+PageUp/Down "previous/next
        // tab" convention instead.
        {
          label: 'Previous Chapter',
          accelerator: isMac ? 'Cmd+Alt+Left' : 'Ctrl+PageUp',
          enabled: state.hasPrevChapter,
          click: () => send('novel:prev-chapter'),
        },
        {
          label: 'Next Chapter',
          accelerator: isMac ? 'Cmd+Alt+Right' : 'Ctrl+PageDown',
          enabled: state.hasNextChapter,
          click: () => send('novel:next-chapter'),
        },
        { type: 'separator' },
        // Snapshot first, then edit bravely. Mod+Shift+T is unclaimed by the
        // editor keymap and the page (see the accelerator policy above).
        {
          label: 'Take Snapshot',
          accelerator: 'CmdOrCtrl+Shift+T',
          enabled: state.hasChapter && !state.busy,
          click: () => send('novel:take-snapshot'),
        },
        {
          label: 'Snapshots…',
          enabled: state.hasChapter,
          click: () => send('novel:snapshots'),
        },
        { type: 'separator' },
        {
          label: 'Codex',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => send('novel:codex'),
        },
      ],
    },
    {
      label: 'AI',
      submenu: [
        {
          label: 'AI Provider Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('ai:settings'),
        },
        { label: 'Test Connection', click: () => send('ai:test') },
      ],
    },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: isMac ? undefined : 'F1', click: showShortcuts },
        { type: 'separator' },
        { label: 'About Ex Libris', click: showAbout },
      ],
    },
  ];
}

function rebuild() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate()));
}

function showAbout() {
  void dialog.showMessageBox(targetWindow ?? undefined, {
    type: 'info',
    title: 'About Ex Libris',
    message: 'Ex Libris',
    detail:
      `A local, AI-assisted novel-writing studio.\n\n` +
      `Version ${app.getVersion()}\n` +
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}\n\n` +
      `Your manuscripts and settings never leave this machine except for the ` +
      `AI provider you configure.`,
    buttons: ['OK'],
  });
}

function showShortcuts() {
  const mod = isMac ? '⌘' : 'Ctrl';
  const lines = [
    `${mod}+Shift+N\tNew novel`,
    `${mod}+N\tNew chapter`,
    `${mod}+P\tExport manuscript`,
    `${mod}+F\tFind in novel`,
    `${mod}+Z / ${isMac ? '⇧⌘Z' : 'Ctrl+Y'}\tUndo / redo`,
    '',
    `${mod}+1 / 2 / 3\tManuscript / Outline / Focus`,
    `${mod}+\\\tCycle views`,
    `Esc\tLeave Focus`,
    `${mod}+Shift+\\\tToggle sidebar`,
    '',
    `${isMac ? '⌘+Alt+← / →' : 'Ctrl+PgUp / PgDn'}\tPrevious / next chapter`,
    `${mod}+Shift+T\tTake snapshot of the chapter`,
    `${mod}+Shift+K\tCodex`,
    `${mod}+,\tAI provider settings`,
    '',
    `In the editor: ${mod}+B bold, ${mod}+I italic, ${mod}+U underline,`,
    `${mod}+E inline code, ${mod}+Shift+S strikethrough, ${mod}+Alt+1–3 headings,`,
    `${mod}+Shift+L/E/R/J text alignment.`,
    `Select any prose to get the AI refine menu.`,
  ];
  void dialog.showMessageBox(targetWindow ?? undefined, {
    type: 'none',
    title: 'Keyboard Shortcuts',
    message: 'Keyboard shortcuts',
    detail: lines.join('\n'),
    buttons: ['OK'],
  });
}

/**
 * Install the menu for a window and start listening for state pushes from its
 * renderer. Call once, after the window is created.
 */
// The renderer's counterpart to Electron's Edit roles. Menu Undo/Redo are
// custom items (they must reach TipTap's own history when the editor has
// focus), so for ordinary inputs the renderer asks for the native behaviour
// back through here — webContents.undo() is the exact plumbing
// `role: 'undo'` would have used.
const NATIVE_EDIT_COMMANDS = new Set(['undo', 'redo']);
let ipcInstalled = false;
function installMenu(win) {
  targetWindow = win;
  if (ipcInstalled) {
    rebuild();
    return;
  }
  ipcInstalled = true;
  ipcMain.on('exlibris:native-edit', (event, command) => {
    if (!targetWindow || event.sender !== targetWindow.webContents) return;
    if (typeof command !== 'string' || !NATIVE_EDIT_COMMANDS.has(command)) return;
    targetWindow.webContents[command]();
  });
  ipcMain.on('exlibris:menu-state', (event, raw) => {
    // Only the window we installed for gets to shape the menu.
    if (!targetWindow || event.sender !== targetWindow.webContents) return;
    const next = sanitizeState(raw);
    if (!next) return;
    state = next;
    rebuild();
  });
  rebuild();
}

module.exports = { installMenu };
