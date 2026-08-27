import { useState, lazy, Suspense } from 'react'
import NodeEditor from './components/NodeEditor'
import ConfigManagerModal from './components/ConfigManagerModal'
import { Loader2 } from 'lucide-react'
import './index.css'

const InventoryOverview = lazy(() => import('./components/InventoryOverview'));
const MassSchedulerPage = lazy(() => import('./pages/MassSchedulerPage'));

type View = 'editor' | 'inventory' | 'scheduler';

function App() {
  const [currentView, setCurrentView] = useState<View>('editor');

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative">
      {/* Main Content */}
      {currentView === 'editor' ? (
        <NodeEditor currentView={currentView} setCurrentView={setCurrentView} />
      ) : (
        <Suspense fallback={
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[var(--interface-bg)] text-muted-foreground">
            <Loader2 size={32} className="animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Завантаження...</span>
          </div>
        }>
          {currentView === 'inventory' ? (
            <InventoryOverview currentView={currentView} setCurrentView={setCurrentView} />
          ) : (
            <MassSchedulerPage currentView={currentView} setCurrentView={setCurrentView} />
          )}
        </Suspense>
      )}
      <ConfigManagerModal />
    </div>
  )
}

export default App
