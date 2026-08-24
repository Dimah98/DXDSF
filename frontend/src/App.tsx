import { useState } from 'react'
import NodeEditor from './components/NodeEditor'
import InventoryOverview from './components/InventoryOverview'
import ConfigManagerModal from './components/ConfigManagerModal'
import MassSchedulerPage from './pages/MassSchedulerPage'
import './index.css'

type View = 'editor' | 'inventory' | 'scheduler';

function App() {
  const [currentView, setCurrentView] = useState<View>('editor');

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative">
      {/* Main Content */}
      {currentView === 'editor' ? (
        <NodeEditor currentView={currentView} setCurrentView={setCurrentView} />
      ) : currentView === 'inventory' ? (
        <InventoryOverview currentView={currentView} setCurrentView={setCurrentView} />
      ) : (
        <MassSchedulerPage currentView={currentView} setCurrentView={setCurrentView} />
      )}
      <ConfigManagerModal />
    </div>
  )
}

export default App
