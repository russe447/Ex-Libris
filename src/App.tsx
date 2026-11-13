import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Editor } from '@/components/editor/Editor';
import { OutlineView } from '@/components/outline/OutlineView';
import { CorkboardView } from '@/components/corkboard/CorkboardView';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { useLibraryStore } from '@/stores/libraryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { initDesktopMenu } from '@/lib/desktopMenu';

function App() {
  // Restores the last novel and, within it, the last chapter you were editing.
  useEffect(() => {
    void useLibraryStore.getState().bootstrap();
  }, []);
  // Desktop only: route native menu actions into the stores and keep the
  // menu's enabled/checked state in sync. No-op in the browser.
  useEffect(() => initDesktopMenu(), []);

  // The workspace view is restored from localStorage by the store itself, so
  // the app reopens exactly where you left it: same view, same chapter.
  const view = useWorkspaceStore((state) => state.view);

  return (
    <ThemeProvider>
      <AppLayout sidebar={view === 'focus' ? null : <Sidebar />}>
        {view === 'outline' ? <OutlineView /> : view === 'corkboard' ? <CorkboardView /> : <Editor />}
      </AppLayout>
    </ThemeProvider>
  );
}

export default App;
