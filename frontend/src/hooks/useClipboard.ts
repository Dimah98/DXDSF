import { useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';

export function useClipboard() {
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  const onCopy = useCallback((nodesRef: React.MutableRefObject<Node[]>, edgesRef: React.MutableRefObject<Edge[]>) => {
    const selectedNodes = nodesRef.current.filter(n => n.selected);
    const selectedNodeIds = selectedNodes.map(n => n.id);
    
    // Беремо всі ребра, які з'єднують виділені ноди
    const edgesToCopy = edgesRef.current.filter(e => 
      e.selected || (selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target))
    );
    
    if (selectedNodes.length > 0) {
      const payload = {
        nodes: JSON.parse(JSON.stringify(selectedNodes)),
        edges: JSON.parse(JSON.stringify(edgesToCopy))
      };
      setClipboard(payload);
      // Зберігаємо в localStorage щоб можна було вставити в контейнер
      try { localStorage.setItem('sfl_node_clipboard', JSON.stringify(payload)); } catch {}
    }
  }, []);

  const getPasteData = useCallback((pos?: { x: number, y: number }) => {
    if (!clipboard) return null;
    const offset = { x: 50, y: 50 };
    const idMap: Record<string, string> = {};
    
    // Глибока копія нод з буфера — НЕ мутуємо оригінальний clipboard state!
    const clipNodes = clipboard.nodes.map(n => ({
      ...n,
      position: { x: n.position.x, y: n.position.y },
    }));

    if (pos && clipNodes.length > 0) {
      const minX = Math.min(...clipNodes.map(n => n.position.x));
      const minY = Math.min(...clipNodes.map(n => n.position.y));
      clipNodes.forEach(n => {
        n.position.x = n.position.x - minX + pos.x;
        n.position.y = n.position.y - minY + pos.y;
      });
    }

    const newNodes = clipNodes.map(node => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap[node.id] = newId;
      return {
        ...node,
        id: newId,
        position: pos ? { x: node.position.x, y: node.position.y } : { x: node.position.x + offset.x, y: node.position.y + offset.y },
        selected: true,
        data: { ...node.data },
      };
    });

    const newEdges = clipboard.edges
      .filter(edge => idMap[edge.source] && idMap[edge.target])
      .map(edge => ({
        ...edge,
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        source: idMap[edge.source],
        target: idMap[edge.target],
        selected: true,
        data: { ...edge.data }
      }));

    return { newNodes, newEdges };
  }, [clipboard]);

  return { clipboard, setClipboard, onCopy, getPasteData };
}
