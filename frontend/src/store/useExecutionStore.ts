import { create } from 'zustand';

interface ExecutionState {
  activeExecutingNodeId: string | null;
  setActiveExecutingNodeId: (nodeId: string | null) => void;

  nodeDataUpdates: { nodeId: string; data: any; timestamp: number } | null;
  updateNodeData: (nodeId: string, data: any) => void;

  botFinishedSignal: number;
  notifyBotFinished: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  activeExecutingNodeId: null,
  setActiveExecutingNodeId: (nodeId) => set({ activeExecutingNodeId: nodeId }),

  nodeDataUpdates: null,
  updateNodeData: (nodeId, data) => set({ nodeDataUpdates: { nodeId, data, timestamp: Date.now() } }),

  botFinishedSignal: 0,
  notifyBotFinished: () => set((state) => ({ botFinishedSignal: state.botFinishedSignal + 1, activeExecutingNodeId: null })),
}));
