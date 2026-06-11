import { useState } from 'react'
import NodeEditor from './components/NodeEditor'
import InventoryOverview from './components/InventoryOverview'
import './index.css'

type View = 'editor' | 'inventory';

function App() {
  const [currentView, setCurrentView] = useState<View>('editor');

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative">
      {/* Floating View Switcher Button */}
      <button
        onClick={() => setCurrentView(currentView === 'editor' ? 'inventory' : 'editor')}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        title={currentView === 'editor' ? 'Switch to Inventory Overview' : 'Switch to Node Editor'}
      >
        {currentView === 'editor' ? '📦 Inventory' : '🔧 Editor'}
      </button>

      {/* Main Content */}
      {currentView === 'editor' ? <NodeEditor /> : <InventoryOverview />}
    </div>
  )
}

export default App
