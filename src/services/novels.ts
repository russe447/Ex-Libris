import { ManuscriptChapter, Novel, NovelSummary, ChapterSummary } from '@/types';
import { API_URL } from '@/services/apiBase';
interface ApiNovel {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  chapterCount?: number;
  wordCount?: number;
}
interface ApiChapterSummary {
  id: string;
  novelId: string;
  title: string;
  synopsis: string;
  status: ChapterSummary['status'];
  pov: string;
  tags: string[];
  color: string;
  wordCount: number;
  position: number;
  createdAt: string;
  lastModified: string;
}
export function toChapterSummary(chapter: ApiChapterSummary): ChapterSummary {
  return {
    ...chapter,
    createdAt: new Date(chapter.createdAt),
    lastModified: new Date(chapter.lastModified),
  };
}
function toNovelSummary(novel: ApiNovel): NovelSummary {
  return {
    id: novel.id,
    title: novel.title,
    chapterCount: novel.chapterCount ?? 0,
    wordCount: novel.wordCount ?? 0,
    createdAt: new Date(novel.createdAt),
    lastModified: new Date(novel.lastModified),
  };
}
export async function fetchNovels(): Promise<NovelSummary[]> {
  const response = await fetch(`${API_URL}/api/novels`);
  if (!response.ok) throw new Error('Failed to fetch novels');
  const data: ApiNovel[] = await response.json();
  return data.map(toNovelSummary);
}
export async function fetchNovel(
  novelId: string
): Promise<Novel & { chapters: ChapterSummary[] }> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}`);
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Novel not found' : 'Failed to fetch novel');
  }
  const data: ApiNovel & { chapters: ApiChapterSummary[] } = await response.json();
  return {
    id: data.id,
    title: data.title,
    createdAt: new Date(data.createdAt),
    lastModified: new Date(data.lastModified),
    chapters: data.chapters.map(toChapterSummary),
  };
}
/** The server creates the novel and its first chapter atomically. */
export async function createNovel(novel: {
  id: string;
  title?: string;
}): Promise<NovelSummary & { chapters: ChapterSummary[] }> {
  const response = await fetch(`${API_URL}/api/novels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(novel),
  });
  if (!response.ok) throw new Error('Failed to create novel');
  const data: ApiNovel & { chapters: ApiChapterSummary[] } = await response.json();
  return { ...toNovelSummary(data), chapters: data.chapters.map(toChapterSummary) };
}
export async function renameNovel(novelId: string, title: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to rename novel');
}
export async function deleteNovel(novelId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete novel');
}
/** Full prose of every chapter, in reading order. */
export async function fetchManuscript(novelId: string): Promise<ManuscriptChapter[]> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/manuscript`);
  if (!response.ok) throw new Error('Failed to fetch manuscript');
  return response.json();
}
