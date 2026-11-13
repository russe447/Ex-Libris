// src/lib/desktopMenu.ts
//
// The renderer half of the native menu (see electron/menu.cjs). Two jobs:
//
//   1. Receive menu actions over the preload bridge and route them into the
//      exact same store calls the buttons already make — the menu is a second
//      keyboard, not a second code path.
//   2. Push a small state snapshot back whenever it changes, so the menu can
//      enable/check the right items (active view, theme, chapter position).
//
// In the browser `window.exlibrisDesktop` doesn't exist and init() is a no-op,
// so the web version is untouched.

import { useLibraryStore } from '@/stores/libraryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { openReferencePane } from '@/lib/splitEditor';
import { themes, themeOrder } from '@/lib/themes';
import { emitUiCommand } from '@/lib/uiBus';

/** The neighbouring chapter in reading order, or null at either end. */
function neighbourChapterId(offset: 1 | -1): string | null {
  const { chapters, activeChapterId } = useLibraryStore.getState();
  if (!activeChapterId) return null;
  const index = chapters.findIndex((chapter) => chapter.id === activeChapterId);
  if (index === -1) return null;
  return chapters[index + offset]?.id ?? null;
}

/**
 * Is focus currently in an ordinary text field (chat box, title input, …)?
 * Menu Undo/Redo should behave natively there, and reach TipTap otherwise.
 */
function inPlainField(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  return el.isContentEditable && !el.closest('.tiptap-editor');
}

function handleMenuAction(action: string): void {
  const workspace = useWorkspaceStore.getState();
  const library = useLibraryStore.getState();

  if (action.startsWith('view:theme:')) {
    useThemeStore.getState().setTheme(action.slice('view:theme:'.length));
    return;
  }

  switch (action) {
    // ----- File -----
    // The isMutating guard backs up the menu's own disabled state: a held-down
    // accelerator can fire again before the next state push lands.
    case 'file:new-novel':
      if (!library.isMutating) void library.createNovel();
      return;
    case 'file:new-chapter':
      if (library.activeNovelId && !library.isMutating) void library.createChapter();
      return;
    case 'file:export':
      // The Export dialog lives in the header, which Focus view hides.
      if (workspace.view === 'focus') workspace.setView('write');
      emitUiCommand('open-export');
      return;

    // ----- Edit -----
    // ProseMirror keeps its own undo stack, so the editor gets TipTap's
    // history; ordinary fields get the native behaviour back via the main
    // process (webContents.undo() — what Electron's `role: 'undo'` runs).
    // execCommand is only a fallback for a stale preload; its redo support
    // in Chromium text fields is unreliable.
    case 'edit:undo':
    case 'edit:redo': {
      const command = action === 'edit:undo' ? 'undo' : 'redo';
      if (!inPlainField()) emitUiCommand(`editor-${command}`);
      else if (window.exlibrisDesktop?.nativeEdit) window.exlibrisDesktop.nativeEdit(command);
      else document.execCommand(command);
      return;
    }
    case 'edit:find':
      workspace.openSidebarTab('search');
      return;

    // ----- View -----
    case 'view:manuscript':
      workspace.setView('write');
      return;
    case 'view:outline':
      workspace.setView('outline');
      return;
    case 'view:focus':
      workspace.setView('focus');
      return;
    case 'view:corkboard':
      workspace.setView('corkboard');
      return;
    case 'view:toggle-split':
      if (workspace.isSplitOpen) {
        workspace.closeSplit();
      } else {
        // The pane lives beside the editor; make sure an editor is on screen.
        if (workspace.view !== 'write' && workspace.view !== 'focus') workspace.setView('write');
        openReferencePane();
      }
      return;
    case 'view:toggle-sidebar':
      workspace.toggleSidebar();
      return;

    // ----- Novel -----
    case 'novel:prev-chapter':
    case 'novel:next-chapter': {
      const id = neighbourChapterId(action === 'novel:next-chapter' ? 1 : -1);
      if (id) void library.openChapter(id);
      return;
    }
    case 'novel:codex':
      workspace.openSidebarTab('codex');
      return;
    // Flushes the editor, then snapshots the persisted chapter. Silent on
    // success by design — the dialog lists it; failure surfaces there too.
    case 'novel:take-snapshot':
      void useSnapshotStore.getState().create();
      return;
    case 'novel:snapshots':
      // The dialog lives in the editor toolbar, which only Manuscript view
      // mounts; the sticky uiBus delivery covers the mount delay.
      if (workspace.view !== 'write') workspace.setView('write');
      emitUiCommand('open-snapshots');
      return;

    // ----- AI -----
    case 'ai:settings':
      workspace.openSidebarTab('settings');
      emitUiCommand('open-ai-settings');
      return;
    case 'ai:test':
      workspace.openSidebarTab('settings');
      emitUiCommand('ai-test-connection');
      return;

    default:
      console.warn('[exlibris] Unknown menu action:', action);
  }
}

// Static for the life of the app, so compute once.
const themeList = themeOrder.map((id) => ({ id, name: themes[id]?.name ?? id }));

let lastPushed = '';

function pushMenuState(): void {
  const bridge = window.exlibrisDesktop;
  if (!bridge?.updateMenuState) return;

  const { view, isSidebarOpen, isSplitOpen } = useWorkspaceStore.getState();
  const { activeNovelId, chapters, activeChapterId, isMutating } = useLibraryStore.getState();
  const index = activeChapterId
    ? chapters.findIndex((chapter) => chapter.id === activeChapterId)
    : -1;

  const snapshot = {
    view,
    sidebarOpen: isSidebarOpen,
    themeId: useThemeStore.getState().themeId,
    themes: themeList,
    hasNovel: Boolean(activeNovelId),
    hasChapter: Boolean(activeChapterId),
    hasPrevChapter: index > 0,
    hasNextChapter: index !== -1 && index < chapters.length - 1,
    // Disables New Novel / New Chapter while a create/delete is in flight so
    // a repeated accelerator can't double-create.
    busy: isMutating,
    splitOpen: isSplitOpen,
  };

  // Stores fire on plenty of changes the menu doesn't care about; only cross
  // the IPC boundary (and rebuild the menu) when something visible moved.
  const json = JSON.stringify(snapshot);
  if (json === lastPushed) return;
  lastPushed = json;
  bridge.updateMenuState(snapshot);
}

/**
 * Wire the native menu up. No-op in the browser. Returns a cleanup function
 * (used by React strict-mode/unmount; in practice it runs for the app's life).
 */
export function initDesktopMenu(): () => void {
  const bridge = window.exlibrisDesktop;
  if (!bridge?.onMenuAction) return () => {};

  const unsubscribeAction = bridge.onMenuAction(handleMenuAction);
  const unsubscribeStores = [
    useWorkspaceStore.subscribe(pushMenuState),
    useLibraryStore.subscribe(pushMenuState),
    useThemeStore.subscribe(pushMenuState),
  ];
  lastPushed = ''; // force an initial push even after a hot-reload re-init
  pushMenuState();

  return () => {
    unsubscribeAction();
    for (const unsubscribe of unsubscribeStores) unsubscribe();
  };
}
