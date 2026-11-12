import { create } from 'zustand';
import {
  AiProvider,
  AiSettings,
  ConnectionTestResult,
  OllamaModel,
  deleteAnthropicKey,
  fetchAiSettings,
  fetchOllamaModels,
  saveAiSettings,
  saveAnthropicKey,
  testAiConnection,
} from '@/services/settings';
import { AiRequestError } from '@/services/anthropic';

export interface AiProblem {
  message: string;
  code: string;
  hint: string | null;
}

function toProblem(error: unknown, fallback: string): AiProblem {
  if (error instanceof AiRequestError) {
    return { message: error.message, code: error.code, hint: error.hint };
  }
  // A failed fetch here means the *app's own* server is down, which is a
  // different problem from the AI provider being down — say so.
  return {
    message: fallback,
    code: 'network',
    hint: 'Is the Ex Libris server running? Try `npm run dev:server`.',
  };
}

interface AiSettingsState {
  settings: AiSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: AiProblem | null;

  ollamaModels: OllamaModel[];
  isLoadingModels: boolean;
  ollamaError: AiProblem | null;

  isTesting: boolean;
  testResult: ConnectionTestResult | null;
  testError: AiProblem | null;

  load: () => Promise<void>;
  update: (patch: Parameters<typeof saveAiSettings>[0]) => Promise<void>;
  setProvider: (provider: AiProvider) => Promise<void>;
  saveKey: (apiKey: string) => Promise<boolean>;
  removeKey: () => Promise<void>;
  refreshOllamaModels: (baseUrl?: string) => Promise<void>;
  test: (override?: Parameters<typeof testAiConnection>[0]) => Promise<void>;
  clearFeedback: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,
  ollamaModels: [],
  isLoadingModels: false,
  ollamaError: null,
  isTesting: false,
  testResult: null,
  testError: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ settings: await fetchAiSettings(), isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: toProblem(error, 'Could not load AI settings.') });
    }
  },

  update: async (patch) => {
    set({ isSaving: true, error: null, testResult: null, testError: null });
    try {
      set({ settings: await saveAiSettings(patch), isSaving: false });
    } catch (error) {
      set({ isSaving: false, error: toProblem(error, 'Could not save AI settings.') });
    }
  },

  setProvider: async (provider) => {
    await get().update({ provider });
  },

  saveKey: async (apiKey) => {
    set({ isSaving: true, error: null, testResult: null, testError: null });
    try {
      set({ settings: await saveAnthropicKey(apiKey), isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false, error: toProblem(error, 'Could not save the API key.') });
      return false;
    }
  },

  removeKey: async () => {
    set({ isSaving: true, error: null });
    try {
      const settings = await deleteAnthropicKey();
      set({ settings, isSaving: false });
    } catch (error) {
      set({ isSaving: false, error: toProblem(error, 'Could not remove the API key.') });
    }
  },

  refreshOllamaModels: async (baseUrlOverride) => {
    const baseUrl = baseUrlOverride ?? get().settings?.ollama.baseUrl ?? '';
    set({ isLoadingModels: true, ollamaError: null });
    try {
      const { models } = await fetchOllamaModels(baseUrl);
      set({ ollamaModels: models, isLoadingModels: false });
    } catch (error) {
      set({
        isLoadingModels: false,
        ollamaModels: [],
        ollamaError: toProblem(error, 'Could not reach Ollama.'),
      });
    }
  },

  test: async (override = {}) => {
    set({ isTesting: true, testResult: null, testError: null });
    try {
      set({ testResult: await testAiConnection(override), isTesting: false });
    } catch (error) {
      set({ isTesting: false, testError: toProblem(error, 'The connection test failed.') });
    }
  },

  clearFeedback: () => set({ error: null, testResult: null, testError: null, ollamaError: null }),
}));
