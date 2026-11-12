// server/router.js
//
// Picks the *tier* for a request, then the provider maps that tier to a model.
// Nothing outside this file decides which model runs — callers describe the
// job, the router grades it.

import { TIERS, getConfig } from './settings.js';

/** Thresholds, in characters. Deliberately generous: misrouting up costs money,
 *  misrouting down costs quality, and quality is the expensive one here. */
const DEEP_CONTEXT_CHARS = 12_000;   // ≈ a long chapter or several short ones
const DEEP_SELECTION_CHARS = 1_500;  // ≈ 250 words of prose under one instruction
const DEEP_MESSAGE_CHARS = 1_200;    // a long, involved question
const QUICK_SELECTION_CHARS = 280;   // a sentence or two
const QUICK_MESSAGE_CHARS = 200;
const QUICK_CONTEXT_CHARS = 2_500;

/** Phrases that mean "spend more on this one". Matched on the user's own words. */
const DEEP_INTENT = /\b(think (?:hard|deeply|carefully)|deep(?:ly|er)? (?:analys|analyz|think|dive)|thorough(?:ly)?|in depth|in-depth|best model|strongest model|take your time|full (?:analysis|review)|line edit)\b/i;

export function isTier(value) {
  return typeof value === 'string' && TIERS.includes(value);
}

/**
 * @param {object} signals
 * @param {'chat'|'refine'} signals.task
 * @param {number} [signals.contextChars]    manuscript + codex context size
 * @param {number} [signals.selectionChars]  refine: length of the selection
 * @param {number} [signals.messageChars]    chat: length of the latest message
 * @param {string} [signals.scope]           chat context scope, if any
 * @param {string} [signals.intentText]      user text to scan for "go deeper"
 * @param {string} [signals.requestedTier]   explicit override, or 'auto'
 * @returns {{tier: string, reason: string, automatic: boolean}}
 */
export function chooseTier(signals = {}) {
  const {
    task = 'chat',
    contextChars = 0,
    selectionChars = 0,
    messageChars = 0,
    scope = null,
    intentText = '',
    requestedTier = 'auto',
  } = signals;

  if (isTier(requestedTier)) {
    return { tier: requestedTier, reason: 'you asked for this tier', automatic: false };
  }

  const { routing } = getConfig();
  if (routing.mode === 'fixed') {
    return {
      tier: routing.fixedTier,
      reason: 'routing is pinned in Settings',
      automatic: false,
    };
  }

  // --- Deep -------------------------------------------------------------
  if (DEEP_INTENT.test(intentText)) {
    return { tier: 'deep', reason: 'you asked for a deeper answer', automatic: true };
  }
  if (scope === 'novel' || scope === 'outline') {
    return {
      tier: 'deep',
      reason: scope === 'novel' ? 'full-novel context' : 'whole-outline context',
      automatic: true,
    };
  }
  if (contextChars > DEEP_CONTEXT_CHARS) {
    return { tier: 'deep', reason: 'large context', automatic: true };
  }
  if (task === 'refine' && selectionChars > DEEP_SELECTION_CHARS) {
    return { tier: 'deep', reason: 'long selection', automatic: true };
  }
  if (task === 'chat' && messageChars > DEEP_MESSAGE_CHARS) {
    return { tier: 'deep', reason: 'long question', automatic: true };
  }

  // --- Quick ------------------------------------------------------------
  if (contextChars <= QUICK_CONTEXT_CHARS) {
    if (task === 'refine' && selectionChars > 0 && selectionChars <= QUICK_SELECTION_CHARS) {
      return { tier: 'quick', reason: 'short inline refine', automatic: true };
    }
    if (task === 'chat' && messageChars > 0 && messageChars <= QUICK_MESSAGE_CHARS) {
      return { tier: 'quick', reason: 'short question, little context', automatic: true };
    }
  }

  return { tier: 'default', reason: 'ordinary request', automatic: true };
}

/**
 * Resolve a tier to a model for the active provider, falling back down the
 * tiers if the author hasn't assigned one (common with Ollama, where Deep may
 * simply not fit on the machine).
 */
export function resolveModel(config, provider, tier) {
  const map = provider === 'ollama' ? config.ollamaTiers : config.anthropicTiers;
  const order = tier === 'deep'
    ? ['deep', 'default', 'quick']
    : tier === 'quick'
      ? ['quick', 'default', 'deep']
      : ['default', 'quick', 'deep'];

  for (const candidate of order) {
    const model = (map?.[candidate] ?? '').trim();
    if (model) {
      return { model, tier: candidate, substituted: candidate !== tier };
    }
  }
  return { model: '', tier, substituted: false };
}
