// src/services/anthropic.ts
import { RefineRequest, RefineResponse, ChatMessage } from '@/types';
import type { AiTier, RouteInfo } from '@/services/settings';
import { API_URL } from '@/services/apiBase';

/**
 * A failure the server could explain: no API key, Ollama not running, model
 * not pulled, and so on. Carries the code so the UI can offer the right fix
 * instead of a generic apology.
 */
export class AiRequestError extends Error {
  code: string;
  hint: string | null;
  /** True when some text had already streamed before the failure. */
  partial: boolean;

  constructor(message: string, code = 'unknown', hint: string | null = null, partial = false) {
    super(message);
    this.name = 'AiRequestError';
    this.code = code;
    this.hint = hint;
    this.partial = partial;
  }
}

async function toAiError(response: Response, fallback: string): Promise<AiRequestError> {
  let payload: { error?: string; code?: string; hint?: string } = {};
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body */
  }
  return new AiRequestError(payload.error || fallback, payload.code || 'unknown', payload.hint ?? null);
}

export async function refineText(
  request: RefineRequest,
  /** Omit for automatic routing. */
  tier?: AiTier
): Promise<RefineResponse> {
  const response = await fetch(`${API_URL}/api/refine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...request, tier }),
  });

  if (!response.ok) {
    throw await toAiError(response, 'Failed to refine text');
  }

  return response.json();
}

export async function sendChatMessage(
  messages: Omit<ChatMessage, 'id' | 'timestamp'>[],
  manuscriptContext?: string,
  codexContext?: string,
  options: { contextScope?: string; tier?: AiTier } = {}
): Promise<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      manuscriptContext,
      codexContext,
      // Routing signals — the server decides the tier, the client only
      // describes the job (and may request a tier explicitly).
      contextScope: options.contextScope,
      tier: options.tier,
    }),
  });

  if (!response.ok) {
    throw await toAiError(response, 'Failed to send message');
  }

  const data = await response.json();
  return data.message;
}

/** Either a text delta or the router's decision, which arrives first. */
export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'route'; route: RouteInfo };

export async function* streamChatMessage(
  messages: Omit<ChatMessage, 'id' | 'timestamp'>[],
  manuscriptContext?: string,
  codexContext?: string,
  options: { contextScope?: string; tier?: AiTier } = {}
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      manuscriptContext,
      codexContext,
      // Routing signals — the server decides the tier, the client only
      // describes the job (and may request a tier explicitly).
      contextScope: options.contextScope,
      tier: options.tier,
    }),
  });

  if (!response.ok) {
    throw await toAiError(response, 'Failed to stream message');
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Chunks split anywhere, including mid-event — buffer until a blank line.
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n');
    buffer = events.pop() ?? '';

    for (const line of events) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        // The server can fail *after* streaming has begun; it reports that as
        // a final error event rather than a dropped connection.
        if (parsed.error) {
          throw new AiRequestError(parsed.error, parsed.code ?? 'unknown', parsed.hint ?? null, received > 0);
        }
        if (parsed.route) {
          yield { type: 'route', route: parsed.route as RouteInfo };
        }
        if (parsed.text) {
          received += 1;
          yield { type: 'text', text: parsed.text };
        }
      } catch (error) {
        if (error instanceof AiRequestError) throw error;
        // Skip invalid JSON
      }
    }
  }
}