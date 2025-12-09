import { AppLayout } from '@/components/layout/AppLayout';
import { Editor } from '@/components/editor/Editor';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

function App() {
  return (
    <ThemeProvider>
      <AppLayout sidebar={<Sidebar />}>
        <Editor />
      </AppLayout>
    </ThemeProvider>
  );
}

export default App;