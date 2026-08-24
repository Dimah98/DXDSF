import type { Edge } from '@xyflow/react';

/**
 * Додає стандартні колбеки (onDelayChange, onDelete) до ребер.
 * Це централізоване місце для керування поведінкою ліній (особливо DelayEdge).
 */
export const attachEdgeCallbacks = (
  edges: Edge[],
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
): Edge[] => {
  return edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      // Зміна затримки на лінії
      onDelayChange: (edgeId: string, newDelay: number) => {
        setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, delay: newDelay } } : e)));
      },
      // Видалення лінії через кнопку на ній
      onDelete: (edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      }
    }
  }));
};

/**
 * Очищає ноди від функцій перед збереженням у JSON.
 * Запобігає збереженню "мертвих" колбеків та зайвому payload.
 */
export const stripFunctionsFromNodes = (nodes: any[]): any[] => {
  return nodes.map(node => {
    const { data, ...rest } = node;
    const cleanData = { ...data };
    
    // Видаляємо всі ключі, що починаються на 'on' (колбеки)
    Object.keys(cleanData).forEach(key => {
      if (key.startsWith('on') && typeof cleanData[key] === 'function') {
        delete cleanData[key];
      }
    });
    
    // Видаляємо globalVariables — вони зберігаються окремо у variables
    // і підставляються в ноди при завантаженні/рендері
    delete cleanData.globalVariables;
    
    // Очищуємо globalVariables з subNodes (GroupNode)
    if (Array.isArray(cleanData.subNodes)) {
      cleanData.subNodes = cleanData.subNodes.map((sub: any) => {
        if (sub?.data?.globalVariables) {
          const { globalVariables, ...cleanSubData } = sub.data;
          return { ...sub, data: cleanSubData };
        }
        return sub;
      });
    }
    
    return { ...rest, data: cleanData };
  });
};
