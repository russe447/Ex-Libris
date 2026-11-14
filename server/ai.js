// server/ai.js
//
// One interface, two backends: Anthropic's hosted API and a local Ollama
// daemon. Every failure path here is *explicit* — a missing key, a daemon
// that isn't running, a model that was never pulled. The old code let those
// surface as a generic 500 (or, for a local daemon, as a request that hangs
// until the browser gives up), which is exactly the behaviour we're fixing.

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicKey, getConfig } from './settings.js';
import { chooseTier, resolveModel } from './router.js';

/** A failure we can explain to the author, with a machine-readable code. */
export class AiError extends Error {
  constructor(code, message, { status = 502, hint = null } = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
  toJSON() {
    return { error: this.message, code: this.code, hint: this.hint };
  }
}

// Ollama on a cold model can take a while to answer, but "a while" is not
// "forever": these bound every phase so nothing hangs open.
const OLLAMA_PROBE_TIMEOUT = 4_000;   // listing models / health check
const OLLAMA_CONNECT_TIMEOUT = 30_000; // waiting for response headers
const OLLAMA_IDLE_TIMEOUT = 120_000;  // between streamed tokens

function normalizeBaseUrl(raw) {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) return 'http://127.0.0.1:11434';
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

function describeFetchFailure(baseUrl, error) {
  const cause = error?.cause?.code || error?.code || '';
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return new AiError(
      'ollama_timeout',
      `Ollama at ${baseUrl} did not respond in time.`,
      { hint: 'Is the model still loading? Try again, or pick a smaller model.' }
    );
  }
  if (cause === 'ECONNREFUSED' || cause === 'ENOTFOUND' || cause === 'EHOSTUNREACH' || cause === 'ECONNRESET') {
    return new AiError(
      'ollama_unreachable',
      `Could not reach Ollama at ${baseUrl}.`,
      { hint: 'Start it with `ollama serve`, then check the URL in Settings → AI provider.' }
    );
  }
  return new AiError('ollama_error', `Ollama request failed: ${error?.message ?? 'unknown error'}`);
}

/* --------------------------------------------------------------- Ollama */

export async function listOllamaModels(baseUrlRaw) {
  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  let response;
  try {
    response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT),
    });
  } catch (error) {
    throw describeFetchFailure(baseUrl, error);
  }
  if (!response.ok) {
    throw new AiError('ollama_error', `Ollama replied ${response.status} to /api/tags.`);
  }
  const data = await response.json().catch(() => ({}));
  const models = Array.isArray(data.models) ? data.models : [];
  return models
    .map((model) => ({
      name: model.name,
      size: model.size ?? null,
      parameterSize: model.details?.parameter_size ?? null,
      family: model.details?.family ?? null,
      modifiedAt: model.modified_at ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ollama tags are `name:tag`. Authors type "llama3.1" and mean "llama3.1:latest",
 * so match loosely before declaring a model missing.
 */
function modelIsPresent(models, wanted) {
  if (!wanted) return false;
  const target = wanted.includes(':') ? wanted : `${wanted}:latest`;
  return models.some((model) => model.name === wanted || model.name === target);
}

async function assertOllamaReady(baseUrl, model) {
  if (!model) {
    throw new AiError('no_model_selected', 'No Ollama model is selected.', {
      status: 400,
      hint: 'Pick one in Settings → AI provider, or pull one with `ollama pull llama3.1`.',
    });
  }
  const models = await listOllamaModels(baseUrl);
  if (models.length === 0) {
    throw new AiError('ollama_no_models', 'Ollama is running but has no models installed.', {
      status: 400,
      hint: 'Pull one first, e.g. `ollama pull llama3.1:8b`.',
    });
  }
  if (!modelIsPresent(models, model)) {
    throw new AiError('ollama_model_missing', `Ollama doesn’t have the model “${model}”.`, {
      status: 400,
      hint: `Run \`ollama pull ${model}\`, or choose one of: ${models.slice(0, 5).map((m) => m.name).join(', ')}.`,
    });
  }
}

/** Streams assistant text from Ollama, calling `onText` per delta. */
async function ollamaStream({ baseUrl, model, system, messages, onText, maxTokens }) {
  await assertOllamaReady(baseUrl, model);

  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(OLLAMA_CONNECT_TIMEOUT),
      body: JSON.stringify({
        model,
        stream: true,
        options: { num_predict: maxTokens ?? 1024 },
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages.map((message) => ({ role: message.role, content: message.content })),
        ],
      }),
    });
  } catch (error) {
    throw describeFetchFailure(baseUrl, error);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 404) {
      throw new AiError('ollama_model_missing', `Ollama doesn’t have the model “${model}”.`, {
        status: 400,
        hint: `Run \`ollama pull ${model}\`.`,
      });
    }
    throw new AiError('ollama_error', `Ollama replied ${response.status}: ${detail.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  // A daemon that accepts the connection and then goes quiet is the worst
  // case for the UI, so each read is on a clock. The timer is CLEARED once
  // the read wins — the previous Promise.race version leaked one pending
  // two-minute timer per streamed chunk.
  const readWithIdleTimeout = async () => {
    let timer;
    try {
      return await Promise.race([
        reader.read(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new AiError('ollama_timeout', 'Ollama stopped sending output.', {
              hint: 'The model may have been unloaded or run out of memory.',
            })),
            OLLAMA_IDLE_TIMEOUT
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    for (;;) {
      const chunk = await readWithIdleTimeout();

      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // NDJSON: one JSON object per line.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (parsed.error) {
          throw new AiError('ollama_error', `Ollama: ${parsed.error}`);
        }
        const text = parsed.message?.content ?? '';
        if (text) {
          full += text;
          onText?.(text);
        }
        if (parsed.done) return full;
      }
    }
    return full;
  } finally {
    // Whatever way we leave (done, mid-stream error, idle timeout), don't
    // leave the HTTP connection to the daemon dangling.
    reader.cancel().catch(() => {});
  }
}

/* ------------------------------------------------------------ Anthropic */

function anthropicClient() {
  const { key } = getAnthropicKey();
  if (!key) {
    throw new AiError('no_api_key', 'No Anthropic API key is configured.', {
      status: 400,
      hint: 'Add one in Settings → AI provider, or switch to a local Ollama model.',
    });
  }
  return new Anthropic({ apiKey: key });
}

function describeAnthropicFailure(error) {
  const status = error?.status;
  if (status === 401) {
    return new AiError('anthropic_auth', 'Anthropic rejected the API key.', {
      status: 400,
      hint: 'Check the key in Settings → AI provider.',
    });
  }
  if (status === 429) {
    return new AiError('anthropic_rate_limit', 'Anthropic rate limit reached.', {
      hint: 'Wait a moment and try again, or use a local model meanwhile.',
    });
  }
  if (status === 404) {
    return new AiError('anthropic_model_missing', 'That Claude model is not available to this key.', {
      status: 400,
      hint: 'Pick a different model in Settings → AI provider.',
    });
  }
  return new AiError('anthropic_error', `Anthropic request failed: ${error?.message ?? 'unknown error'}`);
}

async function anthropicStream({ model, system, messages, onText, maxTokens }) {
  const client = anthropicClient();
  let full = '';
  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens ?? 4096,
      system,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        full += event.delta.text;
        onText?.(event.delta.text);
      }
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw describeAnthropicFailure(error);
  }
  return full;
}

async function anthropicComplete({ model, system, messages, maxTokens }) {
  const client = anthropicClient();
  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens ?? 2048,
      system,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    });
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  } catch (error) {
    throw describeAnthropicFailure(error);
  }
}

/* --------------------------------------------------------------- facade */

/**
 * Resolve a request to a concrete provider + model via the router.
 *
 * `signals` is the job description (see router.chooseTier). Nothing else in
 * the codebase names a model, so changing routing policy means changing the
 * router — not hunting for string literals.
 */
export function route(signals = {}) {
  const config = getConfig();
  const provider = config.provider === 'ollama' ? 'ollama' : 'anthropic';
  const decision = chooseTier(signals);
  const resolved = resolveModel(config, provider, decision.tier);

  return {
    provider,
    baseUrl: normalizeBaseUrl(config.ollamaBaseUrl),
    model: resolved.model,
    tier: resolved.tier,
    requestedTier: decision.tier,
    substituted: resolved.substituted,
    reason: decision.reason,
    automatic: decision.automatic,
  };
}

/** What the server will use right now for an ordinary request. For logging. */
export function activeProvider() {
  return route({ task: 'chat' });
}

function assertModelAssigned(routeInfo) {
  if (routeInfo.model) return;
  if (routeInfo.provider === 'ollama') {
    throw new AiError('no_model_selected', `No Ollama model is assigned to the ${routeInfo.requestedTier} tier.`, {
      status: 400,
      hint: 'Assign models to the Quick/Default/Deep tiers in Settings → AI provider.',
    });
  }
  throw new AiError('no_model_selected', `No Claude model is assigned to the ${routeInfo.requestedTier} tier.`, {
    status: 400,
    hint: 'Pick models for the tiers in Settings → AI provider.',
  });
}

/**
 * Streamed generation. `onText` receives deltas; `onRoute` (optional) is told
 * which model was chosen before the first token. Resolves with the full text.
 */
export async function streamText({ system, messages, onText, onRoute, maxTokens, signals }) {
  const routeInfo = route(signals);
  assertModelAssigned(routeInfo);
  onRoute?.(routeInfo);

  const { provider, model, baseUrl } = routeInfo;
  if (provider === 'ollama') {
    return ollamaStream({ baseUrl, model, system, messages, onText, maxTokens });
  }
  return anthropicStream({ model, system, messages, onText, maxTokens });
}

/** Single-shot generation (used by Refine). Returns text plus the route taken. */
export async function generateText({ system, messages, maxTokens, signals }) {
  const routeInfo = route(signals);
  assertModelAssigned(routeInfo);

  const { provider, model, baseUrl } = routeInfo;
  const text =
    provider === 'ollama'
      ? await ollamaStream({ baseUrl, model, system, messages, maxTokens, onText: null })
      : await anthropicComplete({ model, system, messages, maxTokens });

  return { text, route: routeInfo };
}

/**
 * Dry-run the current (or proposed) configuration so the Settings panel can
 * say "working" before the author stakes a chapter on it.
 */
export async function testConnection(override = {}) {
  const config = { ...getConfig(), ...override };
  const provider = config.provider === 'ollama' ? 'ollama' : 'anthropic';
  // Test one tier at a time, so "Deep is broken" doesn't read as "nothing works".
  const tier = ['quick', 'default', 'deep'].includes(override.tier) ? override.tier : 'default';
  const { model, tier: resolvedTier, substituted } = resolveModel(config, provider, tier);

  if (!model) {
    throw new AiError('no_model_selected', `No model is assigned to the ${tier} tier.`, {
      status: 400,
      hint: 'Assign one in Settings → AI provider.',
    });
  }

  const suffix = substituted ? ` (falling back to the ${resolvedTier} tier)` : '';

  if (provider === 'ollama') {
    const baseUrl = normalizeBaseUrl(config.ollamaBaseUrl);
    const models = await listOllamaModels(baseUrl);
    if (!modelIsPresent(models, model)) {
      throw new AiError('ollama_model_missing', `Ollama doesn’t have “${model}” (${tier} tier).`, {
        status: 400,
        hint: `Run \`ollama pull ${model}\`, or pick another model for this tier.`,
      });
    }
    return {
      ok: true,
      provider,
      tier,
      model,
      detail: `Ollama is running at ${baseUrl} and “${model}” is installed${suffix}.`,
      models: models.map((entry) => entry.name),
    };
  }

  const client = anthropicClient();
  try {
    await client.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
  } catch (error) {
    throw describeAnthropicFailure(error);
  }
  return { ok: true, provider, tier, model, detail: `Anthropic accepted the key for ${model}${suffix}.` };
}
