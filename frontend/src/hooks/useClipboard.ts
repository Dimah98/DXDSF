import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';

// Глобальний буфер у пам'яті, спільний для всіх полотен (головного і внутрішніх під-полотнен)
let memoryClipboard: { nodes: Node[]; edges: Edge[] } | null = null;
try {
  const saved = localStorage.getItem('sfl_node_clipboard');
  if (saved) memoryClipboard = JSON.parse(saved);
} catch {}

export function useClipboard() {
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(() => memoryClipboard);

  // Синхронізація між різними компонентами (головний canvas та sub-canvas)
  useEffect(() => {
    const handleStorageUpdate = (e: any) => {
      if (e.detail) {
        setClipboard(e.detail);
      }
    };
    window.addEventListener('sfl-clipboard-updated', handleStorageUpdate);
    return () => window.removeEventListener('sfl-clipboard-updated', handleStorageUpdate);
  }, []);

  const cleanNodeForClipboard = (node: Node): Node => {
    const { data, ...rest } = node;
    const cleanData = { ...(data || {}) };
    delete cleanData.globalVariables;
    delete cleanData.walletPrivateKey;
    if (node.type === 'roninWalletNode') {
      delete cleanData.privateKey;
      delete cleanData.walletPrivateKey;
    }
    if (Array.isArray(cleanData.subNodes)) {
      cleanData.subNodes = cleanData.subNodes.map((sub: any) => cleanNodeForClipboard(sub));
    }
    return { ...rest, data: cleanData } as Node;
  };

  const onCopy = useCallback((nodesRef: React.MutableRefObject<Node[]>, edgesRef: React.MutableRefObject<Edge[]>) => {
    // Не копіюємо службові ноди входу/виходу контейнера
    const selectedNodes = nodesRef.current.filter(
      n => n.selected && n.type !== 'subEntryNode' && n.type !== 'subExitNode'
    );
    const selectedNodeIds = selectedNodes.map(n => n.id);
    
    // Беремо всі ребра, які з'єднують виділені ноди
    const edgesToCopy = edgesRef.current.filter(e => 
      e.selected || (selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target))
    );
    
    if (selectedNodes.length > 0) {
      const sanitizedNodes = selectedNodes.map(cleanNodeForClipboard);
      const payload = {
        nodes: JSON.parse(JSON.stringify(sanitizedNodes)),
        edges: JSON.parse(JSON.stringify(edgesToCopy))
      };
      memoryClipboard = payload;
      setClipboard(payload);
      // Зберігаємо в localStorage щоб можна було вставити між сесіями або контейнерами
      try { localStorage.setItem('sfl_node_clipboard', JSON.stringify(payload)); } catch {}
      window.dispatchEvent(new CustomEvent('sfl-clipboard-updated', { detail: payload }));
    }
  }, []);

  const getPasteData = useCallback((pos?: { x: number, y: number }) => {
    let clip = clipboard || memoryClipboard;
    if (!clip) {
      try {
        const saved = localStorage.getItem('sfl_node_clipboard');
        if (saved) {
          clip = JSON.parse(saved);
          memoryClipboard = clip;
        }
      } catch {}
    }
    if (!clip || !clip.nodes || clip.nodes.length === 0) return null;

    const offset = { x: 50, y: 50 };
    const idMap: Record<string, string> = {};
    
    // Глибока копія нод з буфера — НЕ мутуємо оригінальний clipboard state!
    const clipNodes = clip.nodes.map(n => ({
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

    const newEdges = clip.edges
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
