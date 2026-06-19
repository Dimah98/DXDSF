import { useEffect, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';

interface UseWebSocketProps {
  WS_HOST: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  nodesRef: React.MutableRefObject<Node[]>;
  subNodeCallbacksRef: React.MutableRefObject<Map<string, (data: any) => void>>;
  setGlobalVariables: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: any) => void;
  setIsBotRunning: React.Dispatch<React.SetStateAction<boolean>>;
  attachCallbacks: (nodes: Node[]) => Node[];
  setDebugImages: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useWebSocket(props: UseWebSocketProps) {
  const { WS_HOST, wsRef } = props;
  const [retryCount, setRetryCount] = useState(0);
  
  // Використовуємо refs для всіх динамічних параметрів, щоб уникнути перепідключень WS
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  useEffect(() => {
    let isMounted = true;

    // Стабільний обробник повідомлень, що завжди використовує актуальні refs
    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { 
          addLog, setNodes, subNodeCallbacksRef, nodesRef, 
          setGlobalVariables, setIsBotRunning, attachCallbacks, setDebugImages 
        } = propsRef.current;

        if (data.type === 'PICKED_SELECTOR' || data.type === 'SELECTOR_INFO_PICKED') {
          addLog(`Отримано селектор: ${data.selector || data.info?.selector}`, 'success');
          
          const subCb = subNodeCallbacksRef.current.get(data.nodeId);
          if (subCb) {
            subCb(data);
            subNodeCallbacksRef.current.delete(data.nodeId);
          } else {
            setNodes((nds) => nds.map((node) => {
              if (node.id === data.nodeId) {
                if (data.pickType === 'parent') return { ...node, data: { ...node.data, parentSelector: data.selector } };
                if (data.pickType === 'child')  return { ...node, data: { ...node.data, childSelector: data.selector } };
              
                if (data.pickType?.startsWith('item_')) {
                  const index = parseInt(data.pickType.split('_')[1]);
                  const newItems = [...((node.data.scanItems as any[]) || [])];
                  if (newItems[index]) newItems[index].selector = data.selector || data.info?.selector;
                  return { ...node, data: { ...node.data, scanItems: newItems } };
                }

                return { ...node, data: { ...node.data, selector: data.selector || data.info?.selector } };
              }
              return node;
            }));
          }
        } else if (data.type === 'GLOBAL_VARIABLES_UPDATE') {
          setGlobalVariables(data.variables || {});
        } else if (data.type === 'UPDATE_NODE_DATA' || data.type === 'NODE_DATA_UPDATE') {
          const newData = data.newData || data.data;
          setNodes((nds) => nds.map((node) => 
            node.id === data.nodeId ? { ...node, data: { ...node.data, ...newData } } : node
          ));
          window.dispatchEvent(new CustomEvent('sfl-node-data-update', { 
            detail: { nodeId: data.nodeId, data: newData } 
          }));
        } else if (data.type === 'NODE_EXECUTING') {
          const node = nodesRef.current.find(n => n.id === data.nodeId);
          const nodeName = data.nodeTitle || node?.data.title || node?.type || 'Нода';
          addLog(`Виконання: ${nodeName}`, 'info', data.context);
          
          window.dispatchEvent(new CustomEvent('sfl-node-executing', { detail: { nodeId: data.nodeId } }));

          setNodes((nds) => nds.map((n) => {
            const isGroup = data.parentGroupId && n.id === data.parentGroupId;
            const isActive = n.id === data.nodeId;
            
            if (isGroup || isActive) {
              return { 
                ...n, 
                style: { ...n.style, boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)', outline: '2px solid #3b82f6' } 
              };
            }
            return {
              ...n,
              style: { ...n.style, boxShadow: 'none', outline: 'none' }
            };
          }));
        } else if (data.type === 'NODE_DISPLAY_DATA') {
          setNodes((nds) => nds.map((node) => {
            if (node.id === data.nodeId) return { ...node, data: { ...node.data, value: data.value, rawData: data.rawData } };
            return node;
          }));
          window.dispatchEvent(new CustomEvent('sfl-node-data-update', { 
            detail: { nodeId: data.nodeId, data: { value: data.value, rawData: data.rawData } } 
          }));
        } else if (data.type === 'BOT_FINISHED') {
          setNodes((nds) => nds.map(n => ({ ...n, style: { ...n.style, boxShadow: 'none', outline: 'none' } })));
          window.dispatchEvent(new CustomEvent('sfl-bot-finished'));
          setIsBotRunning(false);
        } else if (data.type === 'BOT_RUNNING_STATE') {
          setIsBotRunning(data.isRunning);
        } else if (data.type === 'NODE_RECORDED') {
          const newNode: Node = {
            id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: data.nodeType,
            position: { x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 },
            data: data.data,
            dragHandle: '.drag-handle',
          };
          setNodes((nds) => attachCallbacks([...nds, newNode]));
        } else if (data.type === 'CONSOLE_LOG') {
          addLog(data.message, data.logType || 'info', data.data);
        } else if (data.type === 'DEBUG_SNAPSHOT') {
          const node = nodesRef.current.find(n => n.id === data.nodeId);
          const nodeName = node?.data.title || node?.type || 'Нода';
          setDebugImages(prev => [
            { id: Date.now().toString(), time: new Date().toLocaleTimeString(), nodeName, image: data.image },
            ...prev.slice(0, 19)
          ]);
        } else if (data.type === 'SCREENSHOT_SAVED') {
          // Dispatch custom event for ScreenshotSidebar
          window.dispatchEvent(new CustomEvent('screenshot-saved', { detail: data }));
        } else if (data.type === 'ERROR') {
          addLog(`ПОМИЛКА: ${data.message}`, 'error');
          alert(`❌ Помилка: ${data.message}`);
        }
      } catch (err) {
        propsRef.current.addLog(`Помилка парсингу WS: ${err}`, 'error');
        console.error('Помилка парсингу WS:', err);
      }
    };

    const websocket = new WebSocket(WS_HOST);

    websocket.onopen = () => {
      if (!isMounted) return;
      propsRef.current.addLog('З\'єднання встановлено', 'success');
      wsRef.current = websocket;
    };

    websocket.onmessage = messageHandler;

    websocket.onclose = () => {
      if (!isMounted) return;
      propsRef.current.addLog('З\'єднання втрачено. Перепідключення через 3с...', 'error');
      wsRef.current = null;
      setTimeout(() => {
        if (isMounted) setRetryCount(c => c + 1);
      }, 3000);
    };

    websocket.onerror = (e) => {
      const errorMsg = e instanceof Event ? `WebSocket error: ${e.type}` : String(e);
      propsRef.current.addLog(`WebSocket помилка: ${errorMsg}`, 'error');
      console.error('WebSocket помилка:', errorMsg);
    };

    wsRef.current = websocket;
    return () => {
      isMounted = false;
      websocket.close();
    };
  }, [WS_HOST, wsRef, retryCount]);
}
