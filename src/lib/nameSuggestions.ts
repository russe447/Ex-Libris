import { CodexEntry, CodexEntryType, CodexSuggestion } from '@/types';
import { CODEX_TYPE_ORDER } from '@/lib/codex';
/** A name must appear at least this many times before we suggest it. */
export const MIN_OCCURRENCES = 2;
/** Hard cap on how many suggestions we surface at once. */
export const MAX_SUGGESTIONS = 24;
/** Safety valve — never scan more than this much plain text. */
const MAX_SCAN_CHARS = 400_000;
/** Longest multi-word name we will detect ("Order of the Silver Hand"). */
const MAX_PHRASE_TOKENS = 5;
/** Characters of surrounding prose kept as a preview. */
const CONTEXT_CHARS = 160;
/** A single-word name that only ever opens a sentence needs this many hits. */
export const SENTENCE_INITIAL_ONLY_OCCURRENCES = 3;
/** Longest run of lowercase connectors inside a name ("of the"). */
const MAX_CONNECTOR_CHAIN = 2;
/**
 * Every apostrophe-ish codepoint writers and editors actually produce.
 * TipTap, macOS smart substitution, and pasted Word documents all emit U+2019.
 */
const APOSTROPHE_RE = /[\u2018\u2019\u02BC\u2032\u00B4]/g;
/**
 * The single choke point for apostrophe normalization. Everything that compares
 * a string against STOPWORDS, a codex entry name, or a dismissal key must pass
 * through here first — otherwise "I’m" and "I'm" are different words.
 */
export function canonicalizeApostrophes(value: string): string {
  return value.replace(APOSTROPHE_RE, "'");
}
/** Contraction tails. A capitalized token ending in one is never a name. */
const CONTRACTION_SUFFIXES = new Set(['m', 't', 'd', 's', 'll', 've', 're', 'em']);
// ---------------------------------------------------------------------------
// Word lists
// ---------------------------------------------------------------------------
const ARTICLES = new Set(['the', 'a', 'an']);
/** Lowercase words allowed *inside* a name, when a capitalized word follows. */
const CONNECTORS = new Set([
  'of', 'the', 'de', 'del', 'della', 'di', 'da', 'du', 'van', 'von',
  'der', 'den', 'ter', 'la', 'le', 'los', 'las', 'bin', 'ibn', 'al',
]);
/** Titles are stripped from the name but count as strong "person" evidence. */
const HONORIFICS = new Set([
  'mr', 'mrs', 'ms', 'mx', 'dr', 'doctor', 'prof', 'professor', 'sir', 'dame',
  'madam', 'madame', 'miss', 'lord', 'lady', 'king', 'queen', 'prince',
  'princess', 'duke', 'duchess', 'baron', 'baroness', 'count', 'countess',
  'earl', 'captain', 'commander', 'general', 'colonel', 'sergeant',
  'lieutenant', 'admiral', 'marshal', 'father', 'mother', 'sister', 'brother',
  'saint', 'st', 'master', 'mistress', 'aunt', 'uncle', 'reverend', 'rev',
  'chancellor', 'magister', 'inquisitor',
]);
/** Capitalized tokens that are never part of a name. */
const STOPWORDS = new Set([
  // pronouns / determiners
  'i', "i'm", "i'll", "i've", "i'd", 'he', 'she', 'it', 'we', 'they', 'you',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs', 'myself', 'himself', 'herself',
  'itself', 'ourselves', 'themselves', 'yourself',
  'this', 'that', 'these', 'those', 'the', 'a', 'an', 'some', 'any', 'each',
  'every', 'all', 'both', 'either', 'neither', 'another', 'other', 'others',
  'such', 'none', 'nothing', 'something', 'someone', 'somebody', 'anything',
  'anyone', 'anybody', 'everything', 'everyone', 'everybody', 'nobody', 'ones',
  // wh- / conjunctions / adverbs
  'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
  'and', 'but', 'or', 'nor', 'yet', 'so', 'if', 'unless', 'until', 'while',
  'whereas', 'though', 'although', 'because', 'since', 'as', 'than', 'then',
  'thus', 'therefore', 'however', 'moreover', 'meanwhile', 'instead',
  'besides', 'otherwise', 'anyway', 'still', 'already', 'again', 'once',
  'now', 'later', 'soon', 'always', 'never', 'often', 'sometimes', 'rarely',
  'perhaps', 'maybe', 'probably', 'certainly', 'surely', 'suddenly',
  'finally', 'eventually', 'slowly', 'quickly', 'together', 'almost',
  'nearly', 'just', 'even', 'only', 'also', 'too', 'very', 'quite', 'rather',
  'enough', 'more', 'most', 'less', 'least', 'much', 'many', 'few', 'several',
  'here', 'there', 'everywhere', 'somewhere', 'nowhere',
  // interjections / dialogue imperatives
  'yes', 'no', 'okay', 'ok', 'oh', 'ah', 'hey', 'hello', 'goodbye', 'please',
  'thanks', 'thank', 'sorry', 'well', 'look', 'listen', 'wait', 'stop',
  'come', 'go', 'let', "let's", "don't", "can't", "won't", "didn't",
  "doesn't", "isn't", "wasn't", "aren't", "weren't", "haven't", "hasn't",
  "wouldn't", "couldn't", "shouldn't",
  'aye', 'nay', 'yeah', 'yep', 'huh', 'hm', 'hmm', 'mm', 'uh', 'um', 'er',
  'alas', 'indeed', 'nonsense', 'hush', "ma'am", "y'all",
  // prepositions / particles
  'in', 'on', 'at', 'to', 'from', 'with', 'without', 'within', 'into', 'onto',
  'upon', 'under', 'over', 'above', 'below', 'beneath', 'beside', 'behind',
  'before', 'after', 'between', 'among', 'across', 'through', 'toward',
  'towards', 'around', 'along', 'past', 'near', 'beyond', 'outside', 'inside',
  'during', 'against', 'about', 'by', 'of', 'off', 'out', 'up', 'down',
  'back', 'away', 'forward',
  // auxiliaries
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does',
  'did', 'have', 'has', 'had', 'will', 'would', 'shall', 'should', 'can',
  'could', 'may', 'might', 'must',
  // calendar
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'today', 'tomorrow', 'yesterday', 'tonight',
  // manuscript structure
  'chapter', 'prologue', 'epilogue', 'interlude', 'part', 'act', 'scene',
  'page', 'first', 'second', 'third', 'fourth', 'fifth', 'last', 'next',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'hundred', 'thousand',
]);
/** Verbs adjacent to a name that imply a human subject/object. */
const ATTRIBUTION_VERBS = new Set([
  'said', 'says', 'asked', 'asks', 'replied', 'answered', 'whispered',
  'shouted', 'yelled', 'cried', 'muttered', 'murmured', 'growled', 'snapped',
  'called', 'continued', 'added', 'insisted', 'admitted', 'agreed', 'laughed',
  'sighed', 'nodded', 'smiled', 'grinned', 'frowned', 'shrugged', 'breathed',
  'gasped', 'hissed', 'declared', 'announced', 'repeated', 'echoed', 'told',
  'thought', 'wondered', 'realized', 'remembered', 'greeted', 'kissed',
  'hugged', 'glanced', 'stared', 'watched', 'met', 'followed',
]);
/** Prepositions that almost always introduce a location. */
const LOCATIVE_PREPOSITIONS = new Set([
  'in', 'into', 'inside', 'within', 'outside', 'across', 'through',
  'throughout', 'atop', 'beyond',
]);
const TRAVEL_VERBS = new Set([
  'entered', 'reached', 'approached', 'departed', 'visited', 'crossed',
]);
const PLACE_WORDS = new Set([
  'city', 'town', 'village', 'hamlet', 'castle', 'keep', 'fortress', 'citadel',
  'tower', 'spire', 'forest', 'wood', 'woods', 'mountain', 'mountains', 'peak',
  'ridge', 'valley', 'river', 'sea', 'ocean', 'lake', 'isle', 'island', 'bay',
  'harbor', 'harbour', 'port', 'desert', 'plains', 'plain', 'fields', 'hill',
  'hills', 'cave', 'cavern', 'caverns', 'grove', 'glen', 'moor', 'marsh',
  'swamp', 'canyon', 'cliff', 'cliffs', 'falls', 'springs', 'gate', 'gates',
  'bridge', 'road', 'street', 'lane', 'avenue', 'square', 'market', 'district',
  'quarter', 'hall', 'manor', 'mansion', 'estate', 'inn', 'tavern', 'temple',
  'shrine', 'cathedral', 'abbey', 'monastery', 'chapel', 'palace', 'library',
  'prison', 'dungeon', 'mine', 'mines', 'camp', 'outpost', 'garrison', 'realm',
  'kingdom', 'empire', 'province', 'shire', 'lands', 'continent', 'sanctum',
  'crypt', 'tomb', 'catacombs', 'ruins', 'pass', 'summit', 'ford', 'haven',
  'hold', 'reach', 'wastes', 'tundra', 'jungle', 'oasis', 'cove', 'delta',
]);
const ORGANIZATION_WORDS = new Set([
  'order', 'guild', 'company', 'council', 'court', 'house', 'clan', 'legion',
  'brotherhood', 'sisterhood', 'fellowship', 'circle', 'syndicate', 'cabal',
  'coven', 'academy', 'university', 'college', 'church', 'ministry', 'bureau',
  'agency', 'army', 'navy', 'fleet', 'watch', 'guard', 'covenant', 'alliance',
  'federation', 'union', 'league', 'society', 'conclave', 'senate', 'assembly',
  'parliament', 'tribunal', 'inquisition', 'institute', 'corporation',
  'consortium', 'cartel', 'faction', 'tribe', 'corps', 'regiment', 'sect', 'cult',
]);
const ITEM_WORDS = new Set([
  'sword', 'blade', 'dagger', 'knife', 'axe', 'spear', 'lance', 'bow', 'arrow',
  'shield', 'armor', 'armour', 'helm', 'crown', 'ring', 'amulet', 'pendant',
  'necklace', 'talisman', 'charm', 'stone', 'gem', 'jewel', 'crystal', 'orb',
  'staff', 'scepter', 'sceptre', 'wand', 'rod', 'grimoire', 'tome', 'book',
  'codex', 'scroll', 'manuscript', 'ledger', 'journal', 'diary', 'letter',
  'map', 'key', 'lantern', 'lamp', 'mirror', 'cloak', 'mantle', 'robe',
  'chalice', 'goblet', 'horn', 'banner', 'seal', 'relic', 'artifact',
  'artefact', 'elixir', 'potion', 'vial', 'gauntlet', 'locket', 'compass',
  'throne',
]);
const EVENT_WORDS = new Set([
  'war', 'battle', 'siege', 'skirmish', 'raid', 'rebellion', 'uprising',
  'revolt', 'revolution', 'massacre', 'purge', 'plague', 'famine', 'festival',
  'feast', 'ceremony', 'coronation', 'wedding', 'funeral', 'trial',
  'tournament', 'duel', 'hunt', 'accord', 'accords', 'treaty', 'pact',
  'crusade', 'campaign', 'invasion', 'exodus', 'reckoning', 'sundering',
  'cataclysm', 'calamity', 'night', 'dawn', 'age', 'era', 'fall', 'rising',
]);
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Token {
  raw: string;
  start: number;
  end: number;
}
interface Phrase {
  name: string;
  key: string;
  words: string[];
  tokenCount: number;
  /** Index of the leading article if present, else of the first name token. */
  startIndex: number;
  /** Index of the first *name* token (after article + honorifics). */
  nameStartIndex: number;
  /** Exclusive. */
  endIndex: number;
  hasArticle: boolean;
  hasHonorific: boolean;
  hasPossessive: boolean;
}
export interface NameCandidate {
  key: string;
  name: string;
  count: number;
  tokenCount: number;
  midSentenceCount: number;
  lowercaseCount: number;
  scores: Record<CodexEntryType, number>;
  context: string;
}
/** Exported because a NameTally holds these. */
export interface NameTallyEntry {
  key: string;
  count: number;
  tokenCount: number;
  midSentenceCount: number;
  scores: Record<CodexEntryType, number>;
  context: string;
  surfaces: Map<string, number>;
}
/**
 * Raw, unfiltered counts for one body of text. Tallies are *additive*: the
 * tally of a whole novel is the merge of its chapters' tallies. That's what
 * makes novel-wide scanning incremental — we re-tally one edited chapter,
 * not 500,000 characters.
 */
export interface NameTally {
  names: Map<string, NameTallyEntry>;
  lowercase: Map<string, number>;
}
export function createEmptyTally(): NameTally {
  return { names: new Map(), lowercase: new Map() };
}
// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------
const BLOCK_BREAK = /<\/(?:p|div|h[1-6]|li|blockquote|pre|tr)>|<br\s*\/?>/gi;
/** TipTap gives us HTML; flatten it to prose with block tags as line breaks. */
export function htmlToText(html: string): string {
  if (!html) return '';
  return canonicalizeApostrophes(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(BLOCK_BREAK, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      // Decode apostrophe entities before the catch-all sweep, or "I&rsquo;m"
      // becomes "I m" and we detect a bogus single-letter token.
      .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#8216;/gi, "'")
      .replace(/&mdash;/gi, '—')
      .replace(/&amp;/gi, '&')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
  );
}
const SENTENCE_ABBREVIATIONS = [
  'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'st', 'sr', 'jr', 'lt', 'capt',
  'sgt', 'col', 'gen', 'rev', 'hon', 'fr', 'esq', 'vs', 'etc',
];
const ABBREVIATION_RE = new RegExp(`\\b(${SENTENCE_ABBREVIATIONS.join('|')})\\.`, 'gi');
const DOT_PLACEHOLDER = '\u0001';
const DOT_PLACEHOLDER_RE = new RegExp(DOT_PLACEHOLDER, 'g');
/**
 * Split into sentences. We need this purely to know which capitalized words
 * are sentence-initial (and therefore capitalized for boring grammatical
 * reasons rather than because they're proper nouns).
 */
function splitSentences(text: string): string[] {
  return text
    .replace(ABBREVIATION_RE, (_m, word) => `${word}${DOT_PLACEHOLDER}`)
    .split(/(?:[.!?…]+[)"'”’\]]*\s+)|\n+/)
    .map((sentence) => sentence.replace(DOT_PLACEHOLDER_RE, '.').trim())
    .filter(Boolean);
}
const TOKEN_RE = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu;
function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  for (const match of sentence.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    tokens.push({ raw: match[0], start: index, end: index + match[0].length });
  }
  return tokens;
}
function stripPossessive(raw: string): string {
  return canonicalizeApostrophes(raw).replace(/'s$/i, '').replace(/['-]+$/, '');
}
function hasPossessiveSuffix(raw: string): boolean {
  return /['’]s?$/i.test(raw);
}
function normalizeToken(raw: string): string {
  return stripPossessive(raw).toLowerCase(); // already apostrophe-canonical
}
function isCapitalized(raw: string): boolean {
  return /^\p{Lu}/u.test(raw);
}
function isAllCaps(raw: string): boolean {
  return raw.length > 1 && raw === raw.toUpperCase();
}
/**
 * "I'm", "We're", "Don't" — rejected by suffix, so we don't have to enumerate
 * every contraction. Irish/fantasy names survive: the suffix of "O'Brien" is
 * "brien" and the stem "o" is not a stopword.
 */
function isContraction(canonical: string): boolean {
  const apostrophe = canonical.indexOf("'");
  if (apostrophe <= 0) return false;
  const suffix = canonical.slice(apostrophe + 1);
  if (CONTRACTION_SUFFIXES.has(suffix)) return true;          // "Can't", "Thrain'd"
  return STOPWORDS.has(canonical.slice(0, apostrophe));       // "We're", "Y'know"
}
function isStopword(raw: string): boolean {
  const lower = normalizeToken(raw);
  return STOPWORDS.has(lower) || isContraction(lower);
}
/** A token that can participate in a name. */
function isNameToken(token: Token): boolean {
  const stripped = stripPossessive(token.raw);
  if (stripped.length < 2) return false;
  if (!isCapitalized(stripped)) return false;
  return !isStopword(token.raw);
}
/** Two tokens belong to the same phrase only if nothing but spaces separates them. */
function isAdjacent(sentence: string, a: Token, b: Token): boolean {
  return /^\s*$/.test(sentence.slice(a.end, b.start));
}
export function normalizeName(value: string): string {
  return canonicalizeApostrophes(value).trim().replace(/\s+/g, ' ').toLowerCase();
}
function emptyScores(): Record<CodexEntryType, number> {
  return { person: 0, place: 0, item: 0, event: 0, organization: 0, other: 0 };
}
function snippet(sentence: string): string {
  const flat = sentence.replace(/\s+/g, ' ').trim();
  return flat.length > CONTEXT_CHARS ? `${flat.slice(0, CONTEXT_CHARS).trimEnd()}…` : flat;
}
// ---------------------------------------------------------------------------
// Phrase reader
// ---------------------------------------------------------------------------
/**
 * How many lowercase connector tokens at `index` should be absorbed into the
 * name. Returns 0 unless the chain terminates in a real name token, so
 * "Council of the Nine" stops at "Council" (nine is a stopword) while
 * "Order of the Silver Hand" is kept whole.
 */
function readConnectorChain(
  tokens: Token[],
  index: number,
  sentence: string,
  used: number
): number {
  let length = 0;
  while (length < MAX_CONNECTOR_CHAIN && index + length < tokens.length) {
    const token = tokens[index + length];
    if (!CONNECTORS.has(normalizeToken(token.raw))) break;
    if (length > 0 && !isAdjacent(sentence, tokens[index + length - 1], token)) break;
    length += 1;
  }
  if (length === 0) return 0;
  const next = tokens[index + length];
  if (!next || !isNameToken(next)) return 0;
  if (!isAdjacent(sentence, tokens[index + length - 1], next)) return 0;
  if (used + length + 1 > MAX_PHRASE_TOKENS) return 0; // leave room for the name token
  return length;
}
function readPhrase(tokens: Token[], start: number, sentence: string): Phrase | null {
  const first = tokens[start];
  let nameStart = start;
  let articleIndex: number | null = null;
  if (ARTICLES.has(normalizeToken(first.raw))) {
    // Capitalized article: "The Silver Hand".
    const next = tokens[start + 1];
    if (!next || !isNameToken(next) || !isAdjacent(sentence, first, next)) return null;
    articleIndex = start;
    nameStart = start + 1;
  } else if (!isNameToken(first)) {
    return null;
  } else {
    // Lowercase article: "in the Spindle". The caller only ever hands us
    // capitalized tokens, so the article is *behind* us and we must look back —
    // otherwise `prev` resolves to "the" instead of the real preposition, and
    // the name gets scored as a bare (i.e. person) name.
    const previous = tokens[start - 1];
    if (
      previous &&
      ARTICLES.has(normalizeToken(previous.raw)) &&
      isAdjacent(sentence, previous, first)
    ) {
      articleIndex = start - 1;
    }
  }
  const parts: Token[] = [];
  let hasPossessive = false;
  let cursor = nameStart;
  while (cursor < tokens.length && parts.length < MAX_PHRASE_TOKENS) {
    const token = tokens[cursor];
    if (parts.length > 0 && !isAdjacent(sentence, tokens[cursor - 1], token)) break;
    if (isNameToken(token)) {
      parts.push(token);
      cursor += 1;
      // "Marcus's Blade" — the possessive ends the name.
      if (hasPossessiveSuffix(token.raw)) {
        hasPossessive = true;
        break;
      }
      continue;
    }
    const chain = parts.length > 0 ? readConnectorChain(tokens, cursor, sentence, parts.length) : 0;
    if (chain > 0) {
      for (let k = 0; k < chain; k += 1) parts.push(tokens[cursor + k]);
      cursor += chain;
      continue;
    }
    break;
  }
  while (parts.length > 0 && !isNameToken(parts[parts.length - 1])) parts.pop();
  if (parts.length === 0) return null;
  // "Captain Reyes" → "Reyes" (and a strong person signal).
  let hasHonorific = false;
  let offset = 0;
  while (offset < parts.length && HONORIFICS.has(normalizeToken(parts[offset].raw))) {
    hasHonorific = true;
    offset += 1;
  }
  const nameTokens = parts.slice(offset);
  if (nameTokens.length === 0) return null; // bare title: "the King"
  // Ignore shouty headings: "CHAPTER ONE", "THE SILVER HAND".
  if (nameTokens.length > 1 && nameTokens.every((t) => isAllCaps(t.raw))) return null;
  const words = nameTokens.map((t) => normalizeToken(t.raw));
  const name = nameTokens
    .map((t) => (isNameToken(t) ? stripPossessive(t.raw) : stripPossessive(t.raw).toLowerCase()))
    .join(' ');
  const key = normalizeName(name);
  if (key.length < 2 || STOPWORDS.has(key)) return null;
  return {
    name,
    key,
    words,
    tokenCount: nameTokens.length,
    // Index of the article if there is one, so `score()` can reach the token
    // *before* it ("in the Spindle" → "in").
    startIndex: articleIndex ?? nameStart,
    nameStartIndex: nameStart + offset,
    endIndex: cursor,
    hasArticle: articleIndex !== null,
    hasHonorific,
    hasPossessive,
  };
}
// ---------------------------------------------------------------------------
// Type scoring
// ---------------------------------------------------------------------------
function score(candidate: NameTallyEntry, phrase: Phrase, tokens: Token[]): void {
  const s = candidate.scores;
  const prev = tokens[phrase.startIndex - 1];
  const next = tokens[phrase.endIndex];
  const prevLower = prev ? normalizeToken(prev.raw) : null;
  const nextLower = next ? normalizeToken(next.raw) : null;
  if (phrase.hasHonorific) s.person += 5;
  if (phrase.hasPossessive) s.person += 0.5;
  // An article is evidence of exactly one thing: this is not a person. It is
  // not evidence for place/item/event/organization, so it votes for none of
  // them — a name with no other signal falls through to 'other'.
  if (phrase.hasArticle) s.person -= 3;
  if (prevLower && ATTRIBUTION_VERBS.has(prevLower)) s.person += 3; // "said Marcus"
  if (nextLower && ATTRIBUTION_VERBS.has(nextLower)) s.person += 3; // "Marcus said"
  if (prevLower && (LOCATIVE_PREPOSITIONS.has(prevLower) || TRAVEL_VERBS.has(prevLower))) {
    s.place += 1.5; // "in Eldermoor", "entered Eldermoor"
  } else if (!phrase.hasArticle) {
    // A bare capitalized name with no other evidence is usually a character.
    s.person += 0.5;
  }
  for (const word of phrase.words) {
    if (PLACE_WORDS.has(word)) s.place += 3;
    if (ORGANIZATION_WORDS.has(word)) s.organization += 3;
    if (ITEM_WORDS.has(word)) s.item += 3;
    if (EVENT_WORDS.has(word)) s.event += 3;
  }
}
/** Highest concrete score wins; ties break by CODEX_TYPE_ORDER; nothing → 'other'. */
export function guessType(candidate: NameCandidate): CodexEntryType {
  let best: CodexEntryType | null = null;
  let bestScore = 0;
  for (const type of CODEX_TYPE_ORDER) {
    if (type === 'other') continue;
    if (candidate.scores[type] > bestScore) {
      best = type;
      bestScore = candidate.scores[type];
    }
  }
  return best ?? 'other';
}
// ---------------------------------------------------------------------------
// Tallying
// ---------------------------------------------------------------------------
/** Count names in plain text. No thresholds applied — see finalizeTally. */
export function tallyText(text: string): NameTally {
  const tally = createEmptyTally();
  if (!text) return tally;
  for (const sentence of splitSentences(text)) {
    const tokens = tokenize(sentence);
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (!isCapitalized(token.raw)) {
        const lower = normalizeToken(token.raw);
        tally.lowercase.set(lower, (tally.lowercase.get(lower) ?? 0) + 1);
        i += 1;
        continue;
      }
      const phrase = readPhrase(tokens, i, sentence);
      if (!phrase) {
        i += 1;
        continue;
      }
      let entry = tally.names.get(phrase.key);
      if (!entry) {
        entry = {
          key: phrase.key,
          count: 0,
          tokenCount: phrase.tokenCount,
          midSentenceCount: 0,
          scores: emptyScores(),
          context: snippet(sentence),
          surfaces: new Map(),
        };
        tally.names.set(phrase.key, entry);
      }
      entry.count += 1;
      if (phrase.nameStartIndex > 0) entry.midSentenceCount += 1;
      entry.surfaces.set(phrase.name, (entry.surfaces.get(phrase.name) ?? 0) + 1);
      score(entry, phrase, tokens);
      i = Math.max(phrase.endIndex, i + 1);
    }
  }
  return tally;
}
export function tallyHtml(html: string): NameTally {
  return tallyText(htmlToText(html).slice(0, MAX_SCAN_CHARS));
}
function cloneEntry(entry: NameTallyEntry): NameTallyEntry {
  return { ...entry, scores: { ...entry.scores }, surfaces: new Map(entry.surfaces) };
}
/**
 * Sum tallies. Pass chapters in reading order so the surviving `context`
 * snippet is the earliest occurrence in the novel.
 */
export function mergeTallies(tallies: Iterable<NameTally>): NameTally {
  const merged = createEmptyTally();
  for (const tally of tallies) {
    for (const [word, count] of tally.lowercase) {
      merged.lowercase.set(word, (merged.lowercase.get(word) ?? 0) + count);
    }
    for (const [key, entry] of tally.names) {
      const existing = merged.names.get(key);
      if (!existing) {
        merged.names.set(key, cloneEntry(entry));
        continue;
      }
      existing.count += entry.count;
      existing.midSentenceCount += entry.midSentenceCount;
      for (const [surface, n] of entry.surfaces) {
        existing.surfaces.set(surface, (existing.surfaces.get(surface) ?? 0) + n);
      }
      for (const type of CODEX_TYPE_ORDER) {
        existing.scores[type] += entry.scores[type];
      }
      if (!existing.context) existing.context = entry.context;
    }
  }
  return merged;
}
/** Apply the occurrence + lowercase thresholds. Identical rules as before. */
export function finalizeTally(tally: NameTally): NameCandidate[] {
  const results: NameCandidate[] = [];
  for (const entry of tally.names.values()) {
    if (entry.count < MIN_OCCURRENCES) continue;
    const lowercaseCount = tally.lowercase.get(entry.key) ?? 0;
    if (entry.tokenCount === 1) {
      if (lowercaseCount > 0 && entry.midSentenceCount === 0) continue;
      if (lowercaseCount >= entry.count) continue;
      if (entry.midSentenceCount === 0 && entry.count < SENTENCE_INITIAL_ONLY_OCCURRENCES) continue;
    }
    let name = entry.key;
    let best = 0;
    for (const [surface, n] of entry.surfaces) {
      if (n > best) {
        best = n;
        name = surface;
      }
    }
    results.push({
      key: entry.key,
      name,
      count: entry.count,
      tokenCount: entry.tokenCount,
      midSentenceCount: entry.midSentenceCount,
      lowercaseCount,
      scores: entry.scores,
      context: entry.context,
    });
  }
  return results.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
/** Back-compat: scan a single body of HTML end-to-end. Still used by tests. */
export function detectNameCandidates(html: string): NameCandidate[] {
  return finalizeTally(tallyHtml(html));
}
// ---------------------------------------------------------------------------
// Filtering against the existing codex
// ---------------------------------------------------------------------------
/**
 * Every name key the codex already "owns": entry names, their aliases, and the
 * individual words of multi-word names (so "Marcus Vale" suppresses "Marcus").
 */
export function collectCodexNameKeys(entries: CodexEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = normalizeName(entry.name);
    if (!key) continue;
    keys.add(key);
    for (const alias of (entry.fields?.aliases ?? '').split(/[,;/|]/)) {
      const aliasKey = normalizeName(alias);
      if (aliasKey) keys.add(aliasKey);
    }
    const words = key.split(' ').filter((w) => w.length > 1 && !CONNECTORS.has(w) && !ARTICLES.has(w));
    if (words.length > 1) for (const word of words) keys.add(word);
  }
  return keys;
}
export function buildSuggestions(
  candidates: NameCandidate[],
  entries: CodexEntry[],
  dismissedKeys: Iterable<string>
): CodexSuggestion[] {
  const taken = collectCodexNameKeys(entries);
  const dismissed = new Set(dismissedKeys);
  const suggestions: CodexSuggestion[] = [];
  for (const candidate of candidates) {
    if (taken.has(candidate.key) || dismissed.has(candidate.key)) continue;
    suggestions.push({
      key: candidate.key,
      name: candidate.name,
      type: guessType(candidate),
      count: candidate.count,
      context: candidate.context,
    });
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
