// electron/preload.cjs
//
// Runs in the renderer with context isolation on. The app is a plain web app
// that talks HTTP to its own server, so the bridge stays minimal: a desktop
// marker, plus the two halves of the native menu conversation —
//
//   onMenuAction     main → renderer: "the user picked New Chapter"
//   updateMenuState  renderer → main: "here's what should be enabled/checked"
//   nativeEdit       renderer → main: "do a native undo/redo here" — used by
//                    menu Undo/Redo when focus is in an ordinary text field,
//                    where webContents.undo() is the correct (role-equivalent)
//                    behaviour and TipTap's history must not be touched.
//
// Nothing else crosses. The browser version never sees this object at all.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exlibrisDesktop', {
  isDesktop: true,
  platform: process.platform,
  electronVersion: process.versions.electron,

  /**
   * Subscribe to native menu actions. Returns an unsubscribe function.
   * @param {(action: string) => void} handler
   */
  onMenuAction(handler) {
    const listener = (_event, action) => {
      if (typeof action === 'string') handler(action);
    };
    ipcRenderer.on('exlibris:menu-action', listener);
    return () => ipcRenderer.removeListener('exlibris:menu-action', listener);
  },

  /**
   * Tell the menu what to enable/check. Fire-and-forget; the main process
   * sanitizes the payload.
   * @param {object} state
   */
  updateMenuState(state) {
    ipcRenderer.send('exlibris:menu-state', state);
  },

  /**
   * Ask the main process for a native edit command on the focused element.
   * Whitelisted again on the other side.
   * @param {'undo' | 'redo'} command
   */
  nativeEdit(command) {
    if (command === 'undo' || command === 'redo') {
      ipcRenderer.send('exlibris:native-edit', command);
    }
  },
});
