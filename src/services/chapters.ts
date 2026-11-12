import { Chapter, ChapterSummary } from '@/types';
import { toChapterSummary } from '@/services/novels';
import { API_URL } from '@/services/apiBase';
export interface ApiChapter {
  id: string;
  novelId: string;
  title: string;
  content: string;
  wordCount: number;
  position: number;
  createdAt: string;
  lastModified: string;
}
export function toChapter(chapter: ApiChapter): Chapter {
  return {
    ...chapter,
    createdAt: new Date(chapter.createdAt),
    lastModified: new Date(chapter.lastModified),
  };
}
export async function fetchChapter(novelId: string, chapterId: string): Promise<Chapter> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters/${chapterId}`);
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Chapter not found' : 'Failed to fetch chapter');
  }
  return toChapter(await response.json());
}
export async function createChapter(
  novelId: string,
  chapter: { id: string; title?: string; content?: string; wordCount?: number }
): Promise<Chapter> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chapter),
  });
  if (!response.ok) throw new Error('Failed to create chapter');
  return toChapter(await response.json());
}
/**
 * Partial update. Renaming sends only `{ title }` — no content round-trip,
 * which is what the old all-or-nothing document PUT forced on us.
 */
export async function updateChapter(
  novelId: string,
  chapterId: string,
  updates: { title?: string; content?: string; wordCount?: number }
): Promise<Chapter> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update chapter');
  return toChapter(await response.json());
}
export async function deleteChapter(novelId: string, chapterId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters/${chapterId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete chapter');
}
/** Sends the complete desired order; the server rejects anything else. */
export async function reorderChapters(
  novelId: string,
  chapterIds: string[]
): Promise<ChapterSummary[]> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapterIds }),
  });
  if (!response.ok) throw new Error('Failed to reorder chapters');
  const data = await response.json();
  return data.map(toChapterSummary);
}
