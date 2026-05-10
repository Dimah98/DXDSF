import { useState } from 'react'
import NodeEditor from './components/NodeEditor'
import './index.css'

function App() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <main className="flex flex-1 overflow-hidden relative">
        <NodeEditor />
      </main>
    </div>
  )
}

export default App
