// src/lib/codex.ts
import { CodexEntry, CodexEntryType } from '@/types';

export interface CodexFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

export interface CodexTypeDefinition {
  type: CodexEntryType;
  label: string;
  pluralLabel: string;
  fields: CodexFieldDefinition[];
}

/**
 * Single source of truth for entry types and their fields.
 * Add a type or field here — storage (JSON blob) needs no migration.
 */
export const CODEX_TYPES: Record<CodexEntryType, CodexTypeDefinition> = {
  person: {
    type: 'person',
    label: 'Person',
    pluralLabel: 'People',
    fields: [
      { key: 'aliases', label: 'Aliases', placeholder: 'Nicknames, titles, assumed names…' },
      { key: 'role', label: 'Role', placeholder: 'Protagonist, mentor, antagonist…' },
      { key: 'appearance', label: 'Physical description', placeholder: 'Build, features, distinguishing marks…', multiline: true },
      { key: 'personality', label: 'Personality', placeholder: 'Temperament, habits, flaws…', multiline: true },
      { key: 'motivation', label: 'Goals & motivation', placeholder: 'What do they want, and why?', multiline: true },
      { key: 'relationships', label: 'Relationships', placeholder: 'Ties to other characters…', multiline: true },
      { key: 'timeline', label: 'Timeline & backstory', placeholder: 'Key life events in order…', multiline: true },
    ],
  },
  place: {
    type: 'place',
    label: 'Place',
    pluralLabel: 'Places',
    fields: [
      { key: 'location', label: 'Location', placeholder: 'Where is it? Region, relation to other places…' },
      { key: 'description', label: 'Description', placeholder: 'What does it look, sound, smell like?', multiline: true },
      { key: 'atmosphere', label: 'Atmosphere', placeholder: 'Mood, weather, feel…', multiline: true },
      { key: 'significance', label: 'Significance', placeholder: 'Why does it matter to the story?', multiline: true },
      { key: 'history', label: 'History', placeholder: 'Past events tied to this place…', multiline: true },
    ],
  },
  item: {
    type: 'item',
    label: 'Item',
    pluralLabel: 'Items',
    fields: [
      { key: 'description', label: 'Description', placeholder: 'Appearance, materials, condition…', multiline: true },
      { key: 'origin', label: 'Origin', placeholder: 'Who made it, where did it come from?', multiline: true },
      { key: 'properties', label: 'Powers & properties', placeholder: 'What can it do? Any rules or costs?', multiline: true },
      { key: 'whereabouts', label: 'Current owner / location', placeholder: 'Who holds it now?' },
    ],
  },
  event: {
    type: 'event',
    label: 'Event',
    pluralLabel: 'Events',
    fields: [
      { key: 'when', label: 'When', placeholder: 'Date or position in the timeline…' },
      { key: 'where', label: 'Where', placeholder: 'Location(s) involved…' },
      { key: 'participants', label: 'Participants', placeholder: 'Who was involved?' },
      { key: 'summary', label: 'Summary', placeholder: 'What happened?', multiline: true },
      { key: 'consequences', label: 'Consequences', placeholder: 'How did it change things?', multiline: true },
    ],
  },
  organization: {
    type: 'organization',
    label: 'Organization',
    pluralLabel: 'Organizations',
    fields: [
      { key: 'purpose', label: 'Purpose', placeholder: 'What does it exist to do?', multiline: true },
      { key: 'structure', label: 'Members & structure', placeholder: 'Leaders, ranks, notable members…', multiline: true },
      { key: 'base', label: 'Headquarters', placeholder: 'Where does it operate from?' },
      { key: 'history', label: 'History', placeholder: 'Founding, schisms, key moments…', multiline: true },
    ],
  },
  other: {
    type: 'other',
    label: 'Other',
    pluralLabel: 'Other',
    fields: [
      { key: 'description', label: 'Description', placeholder: 'What is it?', multiline: true },
      { key: 'details', label: 'Details', placeholder: 'Anything else worth remembering…', multiline: true },
    ],
  },
};

export const CODEX_TYPE_ORDER: CodexEntryType[] = [
  'person',
  'place',
  'item',
  'event',
  'organization',
  'other',
];

// --- Prompt formatting ---

const MAX_ENTRY_PROMPT_CHARS = 2000;
export const MAX_CODEX_CONTEXT_CHARS = 24000; // server hard-caps at 30k

export function formatEntryForPrompt(entry: CodexEntry): string {
  const definition = CODEX_TYPES[entry.type];
  const lines = [`### ${entry.name} (${definition.label})`];
  for (const field of definition.fields) {
    const value = entry.fields[field.key]?.trim();
    if (value) lines.push(`${field.label}: ${value}`);
  }
  let block = lines.join('\n');
  if (block.length > MAX_ENTRY_PROMPT_CHARS) {
    block = `${block.slice(0, MAX_ENTRY_PROMPT_CHARS)}…`;
  }
  return block;
}

/**
 * Build the codex context block under a total character budget.
 * Entries beyond the budget are dropped (list order = type, then name).
 */
export function buildCodexContext(entries: CodexEntry[]): string {
  const blocks: string[] = [];
  let total = 0;
  for (const entry of entries) {
    const block = formatEntryForPrompt(entry);
    if (total + block.length > MAX_CODEX_CONTEXT_CHARS) break;
    blocks.push(block);
    total += block.length;
  }
  return blocks.join('\n\n');
}
