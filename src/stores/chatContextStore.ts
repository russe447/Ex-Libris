import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatContextScope, isChatContextScope } from '@/lib/manuscript';
import { AiTier, TIER_ORDER } from '@/services/settings';

/** 'auto' hands the choice to the server-side router. */
export type TierPreference = 'auto' | AiTier;

function isTierPreference(value: unknown): value is TierPreference {
  return value === 'auto' || (typeof value === 'string' && (TIER_ORDER as string[]).includes(value));
}

interface ChatContextState {
  /** How much manuscript goes to the assistant. Chapter-only by default. */
  scope: ChatContextScope;
  setScope: (scope: ChatContextScope) => void;
  /** Per-conversation model strength. 'auto' is the router's call. */
  tier: TierPreference;
  setTier: (tier: TierPreference) => void;
}

export const useChatContextStore = create<ChatContextState>()(
  persist(
    (set) => ({
      scope: 'chapter',
      setScope: (scope) => {
        if (isChatContextScope(scope)) set({ scope });
      },
      tier: 'auto',
      setTier: (tier) => {
        if (isTierPreference(tier)) set({ tier });
      },
    }),
    {
      name: 'exlibris-chat-context',
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ChatContextState>;
        return {
          ...current,
          ...saved,
          scope: isChatContextScope(saved.scope) ? saved.scope : current.scope,
          tier: isTierPreference(saved.tier) ? saved.tier : current.tier,
        };
      },
    }
  )
);
