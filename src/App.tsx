import { AppLayout } from '@/components/layout/AppLayout';
import { Editor } from '@/components/editor/Editor';
import { Sidebar } from '@/components/sidebar/Sidebar';

function App() {
  return (
    <AppLayout sidebar={<Sidebar />}>
      <Editor />
    </AppLayout>
  );
}

export default App;