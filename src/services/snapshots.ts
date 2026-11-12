// src/services/snapshots.ts
//
// API client for chapter snapshots. One deliberate asymmetry: creating a
// snapshot sends no content — the server copies the chapter's *persisted*
// prose, so callers must flush the editor first (snapshotStore does).

import { Chapter, ChapterSnapshot } from '@/types';
import { ApiChapter, toChapter } from '@/services/chapters';
import { API_URL } from '@/services/apiBase';

interface ApiSnapshot {
  id: string;
  chapterId: string;
  novelId: string;
  name: string;
  kind: 'manual' | 'auto';
  wordCount: number;
  createdAt: string;
  content?: string;
}

export interface ChapterSnapshotWithContent extends ChapterSnapshot {
  content: string;
}

function toSnapshot(snapshot: ApiSnapshot): ChapterSnapshot {
  return {
    id: snapshot.id,
    chapterId: snapshot.chapterId,
    novelId: snapshot.novelId,
    name: snapshot.name,
    kind: snapshot.kind,
    wordCount: snapshot.wordCount,
    createdAt: new Date(snapshot.createdAt),
  };
}

async function readError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') message = body.error;
  } catch {
    /* non-JSON error body */
  }
  throw new Error(message);
}

function snapshotsUrl(novelId: string, chapterId: string, suffix = ''): string {
  return `${API_URL}/api/novels/${novelId}/chapters/${chapterId}/snapshots${suffix}`;
}

export async function fetchSnapshots(
  novelId: string,
  chapterId: string
): Promise<ChapterSnapshot[]> {
  const response = await fetch(snapshotsUrl(novelId, chapterId));
  if (!response.ok) await readError(response, 'Failed to load snapshots');
  return ((await response.json()) as ApiSnapshot[]).map(toSnapshot);
}

export async function createSnapshot(
  novelId: string,
  chapterId: string,
  name = ''
): Promise<ChapterSnapshot> {
  const response = await fetch(snapshotsUrl(novelId, chapterId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) await readError(response, 'Failed to create snapshot');
  return toSnapshot(await response.json());
}

export async function fetchSnapshotContent(
  novelId: string,
  chapterId: string,
  snapshotId: string
): Promise<ChapterSnapshotWithContent> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}`));
  if (!response.ok) await readError(response, 'Failed to load the snapshot');
  const body = (await response.json()) as ApiSnapshot;
  return { ...toSnapshot(body), content: body.content ?? '' };
}

export async function renameSnapshot(
  novelId: string,
  chapterId: string,
  snapshotId: string,
  name: string
): Promise<ChapterSnapshot> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) await readError(response, 'Failed to rename the snapshot');
  return toSnapshot(await response.json());
}

export async function deleteSnapshot(
  novelId: string,
  chapterId: string,
  snapshotId: string
): Promise<void> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}`), {
    method: 'DELETE',
  });
  if (!response.ok) await readError(response, 'Failed to delete the snapshot');
}

/** The server backs up the current text before overwriting — see the routes. */
export async function restoreSnapshot(
  novelId: string,
  chapterId: string,
  snapshotId: string
): Promise<{ chapter: Chapter; backup: ChapterSnapshot }> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}/restore`), {
    method: 'POST',
  });
  if (!response.ok) await readError(response, 'Failed to restore the snapshot');
  const body = (await response.json()) as { chapter: ApiChapter; backup: ApiSnapshot };
  return { chapter: toChapter(body.chapter), backup: toSnapshot(body.backup) };
}
