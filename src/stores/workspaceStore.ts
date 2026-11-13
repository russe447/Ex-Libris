import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Workspace views.
 *
 * - `write`   — the full three-pane layout: header, editor, sidebar.
 * - `focus`   — the editor alone. Chrome is hidden until you ask for it back.
 * - `outline` — the chapter list promoted to the main surface. Opening a
 *               chapter from here hands you back to `write`.
 * - `corkboard` — chapters as index cards with synopses, Scrivener-style.
 */
export type WorkspaceView = 'write' | 'focus' | 'outline' | 'corkboard';

export const WORKSPACE_VIEWS: WorkspaceView[] = ['write', 'focus', 'outline', 'corkboard'];

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === 'string' && (WORKSPACE_VIEWS as string[]).includes(value);
}

export type SidebarTab = 'chat' | 'codex' | 'library' | 'search' | 'settings';

interface WorkspaceState {
  view: WorkspaceView;
  /** Remembered so returning from Focus doesn't silently re-open the sidebar. */
  isSidebarOpen: boolean;
  sidebarTab: SidebarTab;
  /** Split editor: a read-only reference chapter beside the one being written. */
  isSplitOpen: boolean;
  /** null = pane open but no chapter picked yet. Validated against the live
   *  chapter list at render time, so stale/cross-novel ids fail soft. */
  splitChapterId: string | null;
  /** The split pane's share of the editor row's width (0.25–0.65). */
  splitRatio: number;
  setView: (view: WorkspaceView) => void;
  /** Cycles Write → Focus → Outline → Write. Bound to Ctrl/Cmd+\. */
  cycleView: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  /** Reveals a panel: opens the sidebar (leaving Focus if need be) and selects it. */
  openSidebarTab: (tab: SidebarTab) => void;
  toggleSplit: () => void;
  setSplitChapter: (chapterId: string | null) => void;
  closeSplit: () => void;
  setSplitRatio: (ratio: number) => void;
}

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.42;
  return Math.min(0.65, Math.max(0.25, value));
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      view: 'write',
      isSidebarOpen: true,
      sidebarTab: 'chat',
      isSplitOpen: false,
      splitChapterId: null,
      splitRatio: 0.42,
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
      toggleSplit: () => set((state) => ({ isSplitOpen: !state.isSplitOpen })),
      setSplitChapter: (splitChapterId) => set({ splitChapterId, isSplitOpen: true }),
      closeSplit: () => set({ isSplitOpen: false }),
      setSplitRatio: (ratio) => set({ splitRatio: clampSplitRatio(ratio) }),
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
          isSplitOpen: typeof saved.isSplitOpen === 'boolean' ? saved.isSplitOpen : current.isSplitOpen,
          splitChapterId: typeof saved.splitChapterId === 'string' ? saved.splitChapterId : null,
          splitRatio: clampSplitRatio(
            typeof saved.splitRatio === 'number' ? saved.splitRatio : current.splitRatio
          ),
        };
      },
    }
  )
);
