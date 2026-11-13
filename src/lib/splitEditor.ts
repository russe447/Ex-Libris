// src/lib/splitEditor.ts
//
// Opening the split editor with a sensible default reference chapter: the one
// before the active chapter, else the first other chapter. Shared by the
// toolbar button and the desktop menu; lives outside the component file so
// Fast Refresh stays happy.

import { useLibraryStore } from '@/stores/libraryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function openReferencePane(): void {
  const workspace = useWorkspaceStore.getState();
  const { chapters, activeChapterId } = useLibraryStore.getState();
  const current = workspace.splitChapterId;
  if (current && chapters.some((chapter) => chapter.id === current)) {
    workspace.setSplitChapter(current); // still valid — just reopen
    return;
  }
  const activeIndex = chapters.findIndex((chapter) => chapter.id === activeChapterId);
  const fallback =
    (activeIndex > 0
      ? chapters[activeIndex - 1]
      : chapters.find((chapter) => chapter.id !== activeChapterId)) ??
    // Single-chapter novel: mirror the active chapter itself — the split pane
    // treats same-chapter as one shared document, Scrivener-style.
    chapters.find((chapter) => chapter.id === activeChapterId) ??
    null;
  workspace.setSplitChapter(fallback ? fallback.id : null);
}
