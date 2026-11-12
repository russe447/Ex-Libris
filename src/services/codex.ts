// src/services/codex.ts
import { CodexEntry, CodexEntryType, DismissedSuggestion } from '@/types';
import { API_URL } from '@/services/apiBase';

interface ApiCodexEntry {
  id: string;
  novelId: string;
  type: CodexEntryType;
  name: string;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

function toCodexEntry(entry: ApiCodexEntry): CodexEntry {
  return {
    ...entry,
    fields: entry.fields ?? {},
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  };
}

export async function fetchEntries(novelId: string): Promise<CodexEntry[]> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex`);
  if (!response.ok) throw new Error('Failed to fetch codex entries');
  const data: ApiCodexEntry[] = await response.json();
  return data.map(toCodexEntry);
}

export async function createEntry(
  novelId: string,
  entry: { id: string; type: CodexEntryType; name: string; fields?: Record<string, string> }
): Promise<CodexEntry> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error('Failed to create codex entry');
  return toCodexEntry(await response.json());
}

export async function updateEntry(
  novelId: string,
  entryId: string,
  updates: { type?: CodexEntryType; name?: string; fields?: Record<string, string> }
): Promise<CodexEntry> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex/${entryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update codex entry');
  return toCodexEntry(await response.json());
}

export async function deleteEntry(novelId: string, entryId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex/${entryId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete codex entry');
}

// --- Suggestion dismissals ---
export async function fetchDismissedSuggestions(novelId: string): Promise<DismissedSuggestion[]> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex-dismissals`);
  if (!response.ok) throw new Error('Failed to fetch dismissed suggestions');
  return response.json();
}
/** Returns the normalized key the server stored. */
export async function dismissSuggestion(novelId: string, name: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex-dismissals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Failed to dismiss suggestion');
  const data: { nameKey: string } = await response.json();
  return data.nameKey;
}
export async function restoreDismissedSuggestion(novelId: string, nameKey: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/novels/${novelId}/codex-dismissals/${encodeURIComponent(nameKey)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Failed to restore suggestion');
}
export async function restoreAllDismissedSuggestions(novelId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/codex-dismissals`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to restore suggestions');
}
