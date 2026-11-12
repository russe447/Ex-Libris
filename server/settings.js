// server/settings.js
//
// AI provider settings, including the Anthropic API key.
//
// The key is written to SQLite encrypted with AES-256-GCM. The encryption key
// lives in `.secret` inside the app data directory (mode 0600, see
// server/paths.js), generated on first run — so a stolen
// copy of exlibris.db alone doesn't hand over the credential. It is never sent
// to the browser: the client only ever sees a masked hint like "sk-ant-…4f2a".
//
// This is at-rest protection against casual disclosure (backups, syncing, a
// shared machine). Anyone with read access to both the database *and* the
// secret file can recover the key; that's the same trust boundary as the
// environment variable this replaces.

import crypto from 'node:crypto';
import fs from 'node:fs';
import db from './database.js';
// Lives in the per-user app data directory (see server/paths.js), not the repo.
import { SECRET_PATH } from './paths.js';

/**
 * Job tiers. Every generation request resolves to exactly one of these, and
 * each provider maps them to its own model — nothing downstream ever names a
 * model directly.
 */
export const TIERS = ['quick', 'default', 'deep'];

export const TIER_INFO = [
  {
    id: 'quick',
    label: 'Quick',
    description: 'Short refines and light chat — favour latency over depth.',
  },
  {
    id: 'default',
    label: 'Default',
    description: 'Ordinary chat and typical refines.',
  },
  {
    id: 'deep',
    label: 'Deep',
    description: 'Full-novel context, long selections, or when you ask for it.',
  },
];

/**
 * Claude model IDs, grouped by class. Haiku is the cheap/fast class, Sonnet the
 * balanced one, Opus the strongest.
 */
export const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', class: 'haiku', note: 'Fastest, cheapest' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', class: 'haiku', note: 'Previous fast model' },
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', class: 'sonnet', note: 'Balanced, newest' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', class: 'sonnet', note: 'Balanced' },
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude Sonnet 3.7', class: 'sonnet', note: 'Previous balanced' },
  { id: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1', class: 'opus', note: 'Strongest' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', class: 'opus', note: 'Strong' },
];

const DEFAULTS = {
  provider: 'anthropic',
  anthropicTiers: {
    quick: 'claude-haiku-4-5-20251001',
    default: 'claude-sonnet-4-5-20250929',
    deep: 'claude-opus-4-1-20250805',
  },
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  // Empty until the author picks from what they've actually pulled.
  ollamaTiers: { quick: '', default: '', deep: '' },
  routing: {
    // 'auto' lets the router pick per request; otherwise every request is
    // pinned to `fixedTier`.
    mode: 'auto',
    fixedTier: 'default',
  },
};

function loadSecret() {
  try {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (existing.length >= 64) return Buffer.from(existing, 'hex');
  } catch {
    /* first run */
  }
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_PATH, secret.toString('hex'), { mode: 0o600 });
  try {
    fs.chmodSync(SECRET_PATH, 0o600);
  } catch {
    /* non-POSIX filesystem */
  }
  return secret;
}

let secretKey = null;
function key() {
  if (!secretKey) secretKey = loadSecret();
  return secretKey;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload) {
  try {
    const [version, iv, tag, data] = String(payload).split(':');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    // Usually means .secret was regenerated or the row was tampered with.
    console.error('[exlibris] Could not decrypt a stored secret:', error.message);
    return null;
  }
}

const readStmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
const writeStmt = db.prepare(`
  INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const deleteStmt = db.prepare('DELETE FROM app_settings WHERE key = ?');

function readRaw(key) {
  return readStmt.get(key)?.value ?? null;
}

function writeRaw(key, value) {
  writeStmt.run(key, value, new Date().toISOString());
}

/* ------------------------------------------------------------- public API */

function normalizeTierMap(value, fallback) {
  const map = { ...fallback };
  if (value && typeof value === 'object') {
    for (const tier of TIERS) {
      if (typeof value[tier] === 'string') map[tier] = value[tier];
    }
  }
  return map;
}

export function getConfig() {
  const stored = readRaw('ai_config');
  let parsed = {};
  if (stored) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = {};
    }
  }

  const config = { ...DEFAULTS, ...parsed };

  // Migration: the single-model config (v1 of this feature) becomes the
  // Default tier, so an upgrade never silently changes which model answers.
  config.anthropicTiers = normalizeTierMap(parsed.anthropicTiers, {
    ...DEFAULTS.anthropicTiers,
    ...(parsed.anthropicModel ? { default: parsed.anthropicModel } : {}),
  });
  config.ollamaTiers = normalizeTierMap(parsed.ollamaTiers, {
    quick: parsed.ollamaModel ?? '',
    default: parsed.ollamaModel ?? '',
    deep: parsed.ollamaModel ?? '',
  });
  config.routing = {
    mode: parsed.routing?.mode === 'fixed' ? 'fixed' : 'auto',
    fixedTier: TIERS.includes(parsed.routing?.fixedTier) ? parsed.routing.fixedTier : 'default',
  };

  delete config.anthropicModel;
  delete config.ollamaModel;
  return config;
}

export function saveConfig(patch) {
  const current = getConfig();
  const next = { ...current, ...patch };
  if (patch.anthropicTiers) {
    next.anthropicTiers = normalizeTierMap(patch.anthropicTiers, current.anthropicTiers);
  }
  if (patch.ollamaTiers) {
    next.ollamaTiers = normalizeTierMap(patch.ollamaTiers, current.ollamaTiers);
  }
  if (patch.routing) {
    next.routing = {
      mode: patch.routing.mode === 'fixed' ? 'fixed' : 'auto',
      fixedTier: TIERS.includes(patch.routing.fixedTier)
        ? patch.routing.fixedTier
        : current.routing.fixedTier,
    };
  }
  writeRaw('ai_config', JSON.stringify(next));
  return next;
}

/** The key from settings, falling back to the environment variable. */
export function getAnthropicKey() {
  const stored = readRaw('anthropic_api_key');
  if (stored) {
    const value = decrypt(stored);
    if (value) return { key: value, source: 'settings' };
  }
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return { key: fromEnv, source: 'env' };
  return { key: null, source: 'none' };
}

export function setAnthropicKey(apiKey) {
  writeRaw('anthropic_api_key', encrypt(apiKey));
}

export function clearAnthropicKey() {
  deleteStmt.run('anthropic_api_key');
}

/** "sk-ant-…9f2a" — enough to tell two keys apart, useless to a thief. */
export function maskKey(value) {
  if (!value) return null;
  const tail = value.slice(-4);
  const head = value.slice(0, Math.min(7, Math.max(0, value.length - 4)));
  return `${head}…${tail}`;
}

/** Everything the browser is allowed to know. No secrets here. */
export function describeSettings() {
  const config = getConfig();
  const { key: anthropicKey, source } = getAnthropicKey();
  return {
    provider: config.provider,
    tiers: TIER_INFO,
    routing: config.routing,
    anthropic: {
      tiers: config.anthropicTiers,
      models: ANTHROPIC_MODELS,
      hasKey: Boolean(anthropicKey),
      keySource: source,
      keyHint: maskKey(anthropicKey),
    },
    ollama: {
      baseUrl: config.ollamaBaseUrl,
      tiers: config.ollamaTiers,
    },
  };
}
