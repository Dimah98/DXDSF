import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { attachEdgeCallbacks } from '../utils/flowUtils';

// Інтерфейс для параметрів хука
interface UseCanvasActionsProps {
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onCopyRaw: (nodesRef: React.MutableRefObject<Node[]>, edgesRef: React.MutableRefObject<Edge[]>) => void;
  getPasteData: (pos?: { x: number; y: number }) => { newNodes: Node[]; newEdges: Edge[] } | null;
  attachCallbacks: (nodes: Node[]) => Node[];
  protectedIds?: string[];
}

/**
 * Хук для керування діями на полотні (копіювання, вставка, видалення)
 */
export function useCanvasActions({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  onCopyRaw,
  getPasteData,
  attachCallbacks,
  protectedIds = []
}: UseCanvasActionsProps) {
  
  // Копіювання виділеного
  const onCopy = useCallback(() => {
    onCopyRaw(nodesRef, edgesRef);
  }, [onCopyRaw, nodesRef, edgesRef]);

  // Вставка з буфера
  const onPaste = useCallback((pos?: { x: number; y: number }) => {
    const data = getPasteData(pos);
    if (!data) return;
    const { newNodes, newEdges } = data;
    
    // Використовуємо уніфіковану утиліту для ребер
    const finalEdges = attachEdgeCallbacks(newEdges, setEdges);

    // Знімаємо виділення з поточних і додаємо нові з колбеками
    setNodes((nds) => {
      const deselected = nds.map(n => ({ ...n, selected: false }));
      return [...deselected, ...attachCallbacks(newNodes)];
    });
    
    setEdges((eds) => {
      const deselected = eds.map(e => ({ ...e, selected: false }));
      return [...deselected, ...finalEdges];
    });
  }, [getPasteData, attachCallbacks, setNodes, setEdges]);

  // Видалення виділених елементів
  const onDeleteSelected = useCallback(() => {
    setNodes(nds => nds.filter(n => !n.selected || protectedIds.includes(n.id)));
    setEdges(eds => eds.filter(e => !e.selected));
  }, [setNodes, setEdges, protectedIds]);

  return {
    onCopy,
    onPaste,
    onDeleteSelected
  };
}
