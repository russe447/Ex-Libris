// src/stores/corkboardStore.ts
//
// The corkboard's arrangement for the active novel. Two modes:
//
//   'manuscript'  Cards mirror the real chapter order. Dragging a card calls
//                 the same reorder path the Outline uses — it IS a manuscript
//                 edit, and the author chose that by picking this mode.
//   'custom'      A planning order that lives only on the corkboard (persisted
//                 server-side per novel). Dragging never touches
//                 chapters.position until "Apply to manuscript" is pressed.
//
// The custom order is stored as chapter ids and reconciled lazily against the
// live chapter list: stale ids drop out, new chapters append at the end. That
// way deletes/creates elsewhere never corrupt the plan.

import { create } from 'zustand';
import { ChapterSummary } from '@/types';
import {
  CorkboardMode,
  fetchCorkboard,
  saveCorkboard,
} from '@/services/corkboard';
import { useLibraryStore } from '@/stores/libraryStore';

interface CorkboardState {
  /** The novel the loaded arrangement belongs to. */
  novelId: string | null;
  mode: CorkboardMode;
  order: string[];
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;

  load: (novelId: string) => Promise<void>;
  setMode: (mode: CorkboardMode) => void;
  /**
   * Commit a finished drag: the full displayed order, once. (The view keeps a
   * local preview order *during* the drag so live mode can't spam the server.)
   */
  commitOrder: (displayedIds: string[]) => void;
  /** Commit the custom order to the real manuscript (explicit, never implied).
   *  Resolves true only when the reorder is actually persisted. */
  applyToManuscript: () => Promise<boolean>;
  clearError: () => void;
}

/** Custom order, reconciled: stale ids out, new chapters appended in place. */
export function reconcileOrder(order: string[], chapters: ChapterSummary[]): string[] {
  const known = new Set(chapters.map((chapter) => chapter.id));
  const kept = order.filter((id) => known.has(id));
  const placed = new Set(kept);
  for (const chapter of chapters) {
    if (!placed.has(chapter.id)) kept.push(chapter.id);
  }
  return kept;
}

/** The cards in display order for the current mode. */
export function arrangeChapters(
  chapters: ChapterSummary[],
  mode: CorkboardMode,
  order: string[]
): ChapterSummary[] {
  if (mode === 'manuscript') return chapters;
  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return reconcileOrder(order, chapters)
    .map((id) => byId.get(id))
    .filter((chapter): chapter is ChapterSummary => Boolean(chapter));
}

function persist(novelId: string, mode: CorkboardMode, order: string[]): void {
  // Fire-and-forget, but never silent: a failed save only costs the
  // arrangement (never prose), and the author deserves to know it didn't take.
  saveCorkboard(novelId, { mode, order })
    .then(() => {
      const state = useCorkboardStore.getState();
      if (state.novelId === novelId && state.error?.includes('arrangement')) {
        useCorkboardStore.setState({ error: null });
      }
    })
    .catch((error) => {
      console.error('Failed to save corkboard arrangement:', error);
      if (useCorkboardStore.getState().novelId === novelId) {
        useCorkboardStore.setState({
          error: 'Could not save the arrangement — it may not survive a reload.',
        });
      }
    });
}

export const useCorkboardStore = create<CorkboardState>((set, get) => ({
  novelId: null,
  mode: 'manuscript',
  order: [],
  isLoading: false,
  isApplying: false,
  error: null,

  load: async (novelId) => {
    if (get().novelId === novelId && !get().error) return; // already loaded
    set({ novelId, mode: 'manuscript', order: [], isLoading: true, error: null });
    try {
      const arrangement = await fetchCorkboard(novelId);
      if (get().novelId !== novelId) return; // switched mid-flight
      set({ mode: arrangement.mode, order: arrangement.order, isLoading: false });
    } catch (error) {
      console.error('Failed to load corkboard:', error);
      set({ isLoading: false, error: 'Could not load the corkboard arrangement.' });
    }
  },

  setMode: (mode) => {
    const { novelId, order } = get();
    if (!novelId || get().mode === mode) return;
    let nextOrder = order;
    if (mode === 'custom' && order.length === 0) {
      // First switch to planning mode: start from the manuscript as it stands.
      nextOrder = useLibraryStore.getState().chapters.map((chapter) => chapter.id);
    }
    set({ mode, order: nextOrder });
    persist(novelId, mode, nextOrder);
  },

  commitOrder: (displayedIds) => {
    const { novelId, mode } = get();
    if (!novelId) return;
    const chapters = useLibraryStore.getState().chapters;
    // Whatever the drag produced, normalise it against the live chapter list.
    const next = reconcileOrder(displayedIds, chapters);
    if (mode === 'manuscript') {
      const current = chapters.map((chapter) => chapter.id);
      if (next.join('\u0000') === current.join('\u0000')) return;
      // The author chose live mode: this is a real manuscript reorder, through
      // the same optimistic store action the Outline uses.
      void useLibraryStore.getState().reorderChapters(next);
    } else {
      if (next.join('\u0000') === get().order.join('\u0000')) return;
      set({ order: next });
      persist(novelId, 'custom', next);
    }
  },

  applyToManuscript: async () => {
    const { novelId, mode, order, isApplying } = get();
    if (!novelId || mode !== 'custom' || isApplying) return false;
    const chapters = useLibraryStore.getState().chapters;
    const next = reconcileOrder(order, chapters);
    set({ isApplying: true, error: null });
    // reorderChapters reverts its own optimistic update on failure and tells
    // us — so "Matches manuscript" can never be claimed on a failed apply.
    const ok = await useLibraryStore.getState().reorderChapters(next);
    set({
      isApplying: false,
      error: ok ? null : 'Could not apply the order to the manuscript.',
    });
    return ok;
  },

  clearError: () => set({ error: null }),
}));
