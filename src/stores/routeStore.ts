import { create } from 'zustand';
import type { RouteInfo } from '@/services/settings';

/**
 * The router's most recent decisions, purely for display.
 *
 * Deliberately not persisted: it describes *this session's* traffic, and a
 * stale "answered by Opus" badge after a settings change would be a lie.
 */
interface RouteState {
  /** Keyed by assistant message id, so each reply can show its own model. */
  byMessage: Record<string, RouteInfo>;
  lastChat: RouteInfo | null;
  lastRefine: RouteInfo | null;
  noteRoute: (task: 'chat' | 'refine', route: RouteInfo, messageId?: string) => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  byMessage: {},
  lastChat: null,
  lastRefine: null,
  noteRoute: (task, route, messageId) =>
    set((state) => ({
      byMessage: messageId ? { ...state.byMessage, [messageId]: route } : state.byMessage,
      lastChat: task === 'chat' ? route : state.lastChat,
      lastRefine: task === 'refine' ? route : state.lastRefine,
    })),
}));
