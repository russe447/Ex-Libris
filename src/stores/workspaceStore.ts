import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Workspace views.
 *
 * - `write`   — the full three-pane layout: header, editor, sidebar.
 * - `focus`   — the editor alone. Chrome is hidden until you ask for it back.
 * - `outline` — the chapter list promoted to the main surface. Opening a
 *               chapter from here hands you back to `write`.
 */
export type WorkspaceView = 'write' | 'focus' | 'outline';

export const WORKSPACE_VIEWS: WorkspaceView[] = ['write', 'focus', 'outline'];

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === 'string' && (WORKSPACE_VIEWS as string[]).includes(value);
}

export type SidebarTab = 'chat' | 'codex' | 'library' | 'search' | 'settings';

interface WorkspaceState {
  view: WorkspaceView;
  /** Remembered so returning from Focus doesn't silently re-open the sidebar. */
  isSidebarOpen: boolean;
  sidebarTab: SidebarTab;
  setView: (view: WorkspaceView) => void;
  /** Cycles Write → Focus → Outline → Write. Bound to Ctrl/Cmd+\. */
  cycleView: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  /** Reveals a panel: opens the sidebar (leaving Focus if need be) and selects it. */
  openSidebarTab: (tab: SidebarTab) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      view: 'write',
      isSidebarOpen: true,
      sidebarTab: 'chat',
      setView: (view) => {
        if (!isWorkspaceView(view) || get().view === view) return;
        set({ view });
      },
      cycleView: () => {
        const next = WORKSPACE_VIEWS[(WORKSPACE_VIEWS.indexOf(get().view) + 1) % WORKSPACE_VIEWS.length];
        set({ view: next });
      },
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      openSidebarTab: (sidebarTab) =>
        set((state) => ({
          sidebarTab,
          isSidebarOpen: true,
          view: state.view === 'focus' ? 'write' : state.view,
        })),
    }),
    {
      name: 'exlibris-workspace',
      // A view persisted by a future/older build shouldn't strand the user in a
      // layout this build can't render.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<WorkspaceState>;
        return {
          ...current,
          ...saved,
          view: isWorkspaceView(saved.view) ? saved.view : current.view,
          isSidebarOpen: typeof saved.isSidebarOpen === 'boolean' ? saved.isSidebarOpen : current.isSidebarOpen,
          sidebarTab: saved.sidebarTab ?? current.sidebarTab,
        };
      },
    }
  )
);
