import { AiRequestError } from '@/services/anthropic';
import { API_URL } from '@/services/apiBase';

export type AiProvider = 'anthropic' | 'ollama';
export type AiTier = 'quick' | 'default' | 'deep';

export const TIER_ORDER: AiTier[] = ['quick', 'default', 'deep'];

export type TierMap = Record<AiTier, string>;

export interface TierInfo {
  id: AiTier;
  label: string;
  description: string;
}

export interface RoutingConfig {
  mode: 'auto' | 'fixed';
  fixedTier: AiTier;
}

/** Which model actually answered, and why the router chose it. */
export interface RouteInfo {
  provider: AiProvider;
  model: string;
  tier: AiTier;
  requestedTier: AiTier;
  substituted: boolean;
  reason: string;
  automatic: boolean;
}

export interface AiSettings {
  provider: AiProvider;
  tiers: TierInfo[];
  routing: RoutingConfig;
  anthropic: {
    tiers: TierMap;
    models: { id: string; label: string; class: string; note?: string }[];
    /** Whether a usable key exists — the key itself never leaves the server. */
    hasKey: boolean;
    keySource: 'settings' | 'env' | 'none';
    keyHint: string | null;
  };
  ollama: {
    baseUrl: string;
    tiers: TierMap;
  };
}

export interface OllamaModel {
  name: string;
  size: number | null;
  parameterSize: string | null;
  family: string | null;
  modifiedAt: string | null;
}

export interface ConnectionTestResult {
  ok: true;
  provider: AiProvider;
  tier: AiTier;
  model: string;
  detail: string;
  models?: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    let payload: { error?: string; code?: string; hint?: string } = {};
    try {
      payload = await response.json();
    } catch {
      /* non-JSON body */
    }
    throw new AiRequestError(
      payload.error || 'Request failed',
      payload.code || 'unknown',
      payload.hint ?? null
    );
  }
  return response.json();
}

export function fetchAiSettings(): Promise<AiSettings> {
  return request<AiSettings>('/api/settings/ai');
}

export function saveAiSettings(patch: {
  provider?: AiProvider;
  anthropicTiers?: Partial<TierMap>;
  ollamaBaseUrl?: string;
  ollamaTiers?: Partial<TierMap>;
  routing?: RoutingConfig;
}): Promise<AiSettings> {
  return request<AiSettings>('/api/settings/ai', { method: 'PUT', body: JSON.stringify(patch) });
}

/** Write-only. The response describes the key; it never contains it. */
export function saveAnthropicKey(apiKey: string): Promise<AiSettings> {
  return request<AiSettings>('/api/settings/ai/key', {
    method: 'PUT',
    body: JSON.stringify({ apiKey }),
  });
}

export function deleteAnthropicKey(): Promise<AiSettings & { fellBackToEnv: boolean }> {
  return request<AiSettings & { fellBackToEnv: boolean }>('/api/settings/ai/key', {
    method: 'DELETE',
  });
}

export function fetchOllamaModels(baseUrl: string): Promise<{ models: OllamaModel[] }> {
  return request<{ models: OllamaModel[] }>(
    `/api/settings/ai/ollama/models?baseUrl=${encodeURIComponent(baseUrl)}`
  );
}

export function testAiConnection(override: {
  provider?: AiProvider;
  ollamaBaseUrl?: string;
  /** Which tier to exercise. Defaults to Default. */
  tier?: AiTier;
}): Promise<ConnectionTestResult> {
  return request<ConnectionTestResult>('/api/settings/ai/test', {
    method: 'POST',
    body: JSON.stringify(override),
  });
}
