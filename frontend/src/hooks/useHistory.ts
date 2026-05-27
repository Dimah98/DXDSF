import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

export function useHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void,
  attachCallbacks: (nodes: Node[]) => Node[]
) {
  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  // Function to save the current state to history.
  // Should be called BEFORE a modifying action (like delete or drop).
  const takeSnapshot = useCallback(() => {
    setPast((p) => {
      // Deep copy to prevent reference issues
      const snapshot = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      const newPast = [...p, snapshot];
      if (newPast.length > 50) newPast.shift(); // Max 50 states
      return newPast;
    });
    setFuture([]); // Clear future on new action
  }, [nodes, edges]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      const newPast = p.slice(0, p.length - 1);

      setFuture((f) => {
        const currentSnapshot = {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
        };
        return [currentSnapshot, ...f];
      });

      setNodes(attachCallbacks(JSON.parse(JSON.stringify(prev.nodes))));
      setEdges(JSON.parse(JSON.stringify(prev.edges)));

      return newPast;
    });
  }, [nodes, edges, setNodes, setEdges, attachCallbacks]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      const newFuture = f.slice(1);

      setPast((p) => {
        const currentSnapshot = {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
        };
        return [...p, currentSnapshot];
      });

      setNodes(attachCallbacks(JSON.parse(JSON.stringify(next.nodes))));
      setEdges(JSON.parse(JSON.stringify(next.edges)));

      return newFuture;
    });
  }, [nodes, edges, setNodes, setEdges, attachCallbacks]);

  // Hook up keyboard listeners automatically
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return { takeSnapshot, undo, redo, past, future };
}
