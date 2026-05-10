import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Play, Square, ArrowRightLeft, Smile, Copy, Trash2, Globe, Terminal, ChevronUp, ChevronDown, XCircle, Camera, Image as ImageIcon
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Connection,
  type Edge,
  type Node,
  SelectionMode,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ActionNode from './CustomNodes/ActionNode';
import StartNode from './CustomNodes/StartNode';
import ConditionNode from './CustomNodes/ConditionNode';
import BrowserNode from './CustomNodes/BrowserNode';
import InfoNode from './CustomNodes/InfoNode';
import DisplayNode from './CustomNodes/DisplayNode';
import ImageSearchNode from './CustomNodes/ImageSearchNode';
import SelectorCheckNode from './CustomNodes/SelectorCheckNode';
import CoordClickNode from './CustomNodes/CoordClickNode';
import NestedCheckNode from './CustomNodes/NestedCheckNode';
import KeyboardNode from './CustomNodes/KeyboardNode';
import VisualSearchNode from './CustomNodes/VisualSearchNode';
import ApiNode from './CustomNodes/ApiNode';
import VariableNode from './CustomNodes/VariableNode';
import ValueLoopNode from './CustomNodes/ValueLoopNode';
import MultiLogicNode from './CustomNodes/MultiLogicNode';
import SearchInNode from './CustomNodes/SearchInNode';
import CompareNode from './CustomNodes/CompareNode';
import MultiScanNode from './CustomNodes/MultiScanNode';
import TextCompareNode from './CustomNodes/TextCompareNode';
import EscNode from './CustomNodes/EscNode';
import DelayEdge from './DelayEdge';
import GlobalSettings from './GlobalSettings';
import Sidebar from './Sidebar';
import StreamPicker from './StreamPicker';

// Реєстрація типів нод
const nodeTypes = {
  actionNode: ActionNode,
  startNode: StartNode,
  conditionNode: ConditionNode,
  browserNode: BrowserNode,
  infoNode: InfoNode,
  displayNode: DisplayNode,
  imageSearchNode: ImageSearchNode,
  selectorCheckNode: SelectorCheckNode,
  coordClickNode: CoordClickNode,
  nestedCheckNode: NestedCheckNode,
  keyboardNode: KeyboardNode,
  visualSearchNode: VisualSearchNode,
  apiNode: ApiNode,
  variableNode: VariableNode,
  valueLoopNode: ValueLoopNode,
  multiLogicNode: MultiLogicNode,
  searchInNode: SearchInNode,
  compareNode: CompareNode,
  multiScanNode: MultiScanNode,
  textCompareNode: TextCompareNode,
  escNode: EscNode,
};

// Реєстрація типів ліній
const edgeTypes = {
  delayEdge: DelayEdge,
};

// Початкова нода Старт
const initialNodes: Node[] = [
  {
    id: 'start_1',
    type: 'startNode',
    data: { label: 'Початок' },
    position: { x: 250, y: 50 },
    dragHandle: '.drag-handle',
  },
];

let id = Date.now();
const getId = () => `node_${id++}`;

// Динамічний хост для підключення з телефону
// Якщо ми в Telegram (через тунель), localhost не спрацює. 
// В ідеалі тут має бути IP вашого комп'ютера в мережі Wi-Fi
const getApiHost = () => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return `http://localhost:3001`;
  // LocalTunnel API
  return "https://real-turtles-lead.loca.lt"; 
};

const getWsHost = () => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return `ws://localhost:3002`;
  // LocalTunnel WS
  return "wss://red-bobcats-flow.loca.lt";
};

const API_HOST = getApiHost();
const WS_HOST = getWsHost();

const NodeEditor = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [logs, setLogs] = useState<{ id: string, time: string, type: 'info' | 'error' | 'success' | 'debug', message: string, data?: any }[]>([]);
  const [debugImages, setDebugImages] = useState<{ id: string, time: string, nodeName: string, image: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'photos'>('logs');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  // Використовуємо ref для ws щоб уникнути stale closure в колбеках нод
  const wsRef = useRef<WebSocket | null>(null);
  // Використовуємо ref для nodes/edges щоб runBot завжди читав актуальні дані
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const [clipboard, setClipboard] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);
  const [menu, setMenu] = useState<{ x: number, y: number, type: 'pane' | 'node', nodeId?: string } | null>(null);
  const [theme] = useState<'light' | 'dark'>('dark'); 
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerConfig, setPickerConfig] = useState<{ nodeId: string, pickType: string } | null>(null);

  // Слухаємо запуск пікера з будь-якої ноди
  useEffect(() => {
    const handleTrigger = (e: any) => {
      setPickerConfig({ nodeId: e.detail.nodeId, pickType: e.detail.pickType || 'default' });
    };
    window.addEventListener('trigger-stream-picker', handleTrigger);
    return () => window.removeEventListener('trigger-stream-picker', handleTrigger);
  }, []);
  const [snapToGrid, setSnapToGrid] = useState(() => {
    const saved = localStorage.getItem('sfl_global_settings_v3');
    return saved ? JSON.parse(saved).snapToGrid : true;
  });

  // Ініціалізація Telegram WebApp
  useEffect(() => {
    console.log('NodeEditor: Mounting...');
    console.log('API_HOST:', API_HOST);
    console.log('WS_HOST:', WS_HOST);
    
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      console.log('Telegram WebApp detected:', tg.version);
      tg.expand();
      tg.ready();
      try { tg.enableClosingConfirmation(); } catch(e) {}
    }

    // Додаємо тестову ноду якщо порожньо, щоб бачити що рендер працює
    setNodes((nds) => nds.length === 0 ? [
      { 
        id: 'welcome', 
        type: 'infoNode', 
        position: { x: 250, y: 150 }, 
        data: { label: 'Конструктор готовий!', description: 'Додайте ноди через меню праворуч знизу' } 
      }
    ] : nds);

    // Заборона контекстного меню для точок з'єднання (Handles) - важливо для мобільних
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.react-flow__handle')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('contextmenu', handleGlobalContextMenu, true);
    return () => {
      document.removeEventListener('contextmenu', handleGlobalContextMenu, true);
    };
  }, []);

  // Синхронізуємо refs з state кожного ре-рендеру
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Слухаємо глобальні налаштування
  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail && e.detail.snapToGrid !== undefined) {
        setSnapToGrid(e.detail.snapToGrid);
      }
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  // Допоміжна функція для додавання логів
  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' | 'debug' = 'info', data?: any) => {
    setLogs(prev => [
      { id: Date.now().toString() + Math.random(), time: new Date().toLocaleTimeString(), type, message, data },
      ...prev.slice(0, 99)
    ]);
  }, []);

  // Підключення WebSocket
  useEffect(() => {
    const websocket = new WebSocket(WS_HOST);

    websocket.onopen = () => {
      addLog('З\'єднання встановлено', 'success');
      wsRef.current = websocket;
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // console.log('WS Message:', data.type); // Тимчасовий дебаг
        // Отримали вибраний селектор від пікера
        if (data.type === 'PICKED_SELECTOR' || data.type === 'SELECTOR_INFO_PICKED') {
          addLog(`Отримано селектор: ${data.selector || data.info?.selector}`, 'success');
          setNodes((nds) => nds.map((node) => {
            if (node.id === data.nodeId) {
              if (data.pickType === 'parent') return { ...node, data: { ...node.data, parentSelector: data.selector } };
              if (data.pickType === 'child')  return { ...node, data: { ...node.data, childSelector: data.selector } };
              
              // Обробка для пунктів мульти-сканера (item_0, item_1...)
              if (data.pickType?.startsWith('item_')) {
                const index = parseInt(data.pickType.split('_')[1]);
                const newItems = [...(node.data.scanItems || [])];
                if (newItems[index]) {
                  newItems[index].selector = data.selector || data.info?.selector;
                }
                return { ...node, data: { ...node.data, scanItems: newItems } };
              }

              // Якщо прийшла повна інфа від сканера — зберігаємо selector
              return { ...node, data: { ...node.data, selector: data.selector || data.info?.selector } };
            }
            return node;
          }));
        } else if (data.type === 'GLOBAL_VARIABLES_UPDATE') {
          // Оновлюємо відображення змінних у відповідних нодах
          setNodes((nds) => nds.map((node) => {
            if (node.type === 'variableNode' || node.type === 'multiLogicNode') {
              return { ...node, data: { ...node.data, currentValues: data.variables } };
            }
            return node;
          }));
        } else if (data.type === 'NODE_EXECUTING') {
          // Підсвічуємо активну ноду
          const node = nodesRef.current.find(n => n.id === data.nodeId);
          const nodeName = node?.data.title || node?.type || 'Нода';
          addLog(`Виконання: ${nodeName}`, 'info', data.context);
          setNodes((nds) => nds.map((node) => ({
            ...node,
            style: node.id === data.nodeId
              ? { ...node.style, boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)', outline: '2px solid #3b82f6' }
              : { ...node.style, boxShadow: 'none', outline: 'none' }
          })));
        } else if (data.type === 'NODE_DISPLAY_DATA') {
          // Відображаємо значення у Display ноді
          setNodes((nds) => nds.map((node) => {
            if (node.id === data.nodeId) return { ...node, data: { ...node.data, value: data.value } };
            return node;
          }));
        } else if (data.type === 'NODE_DATA_UPDATE') {
          // Оновлюємо дані ноди з бекенду (Сканер, API тощо)
          setNodes((nds) => nds.map((node) => {
            if (node.id === data.nodeId) return { ...node, data: { ...node.data, ...data.data } };
            return node;
          }));
        } else if (data.type === 'BOT_FINISHED') {
          setNodes((nds) => nds.map(n => ({ ...n, style: { ...n.style, boxShadow: 'none', outline: 'none' } })));
        } else if (data.type === 'NODE_RECORDED') {
          const newNode: Node = {
            id: `node_${Date.now()}`,
            type: data.nodeType,
            position: { x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 },
            data: data.data,
            dragHandle: '.drag-handle',
          };
          setNodes((nds) => attachCallbacks([...nds, newNode]));
        } else if (data.type === 'CONSOLE_LOG') {
          addLog(data.message, data.logType || 'info');
        } else if (data.type === 'DEBUG_SNAPSHOT') {
          console.log('Отримано скріншот:', data.nodeId, 'Довжина:', data.image?.length);
          const node = nodesRef.current.find(n => n.id === data.nodeId);
          const nodeName = node?.data.title || node?.type || 'Нода';
          setDebugImages(prev => [
            { id: Date.now().toString(), time: new Date().toLocaleTimeString(), nodeName, image: data.image },
            ...prev.slice(0, 19) // Зберігаємо останні 20 скріншотів
          ]);
          // Якщо прийшов скріншот — автоматично перемикаємо на вкладку фото (опціонально, але корисно)
          // setActiveTab('photos'); 
        } else if (data.type === 'ERROR') {
          addLog(`ПОМИЛКА: ${data.message}`, 'error');
          alert(`❌ Помилка: ${data.message}`);
        }
      } catch (err) {
        addLog(`Помилка парсингу WS: ${err}`, 'error');
        console.error('Помилка парсингу WS:', err);
      }
    };

    websocket.onclose = () => {
      addLog('З\'єднання втрачено', 'error');
      console.log('WebSocket відключено');
      wsRef.current = null;
    };

    websocket.onerror = (e) => console.error('WebSocket помилка:', e);

    wsRef.current = websocket;
    return () => websocket.close();
  }, [setNodes]);

  // ── Загальні колбеки для нод — завжди беруть актуальний ws з ref ──

  // Запустити пікер елемента у браузері
  const handlePickElement = useCallback((nodeId: string, pickType: string = 'default') => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'START_PICKER', nodeId, pickType }));
    } else {
      alert('WebSocket не підключено. Перевірте що бекенд запущено.');
    }
  }, []);

  // Змінити дані конкретної ноди
  const handleDataChange = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
  }, [setNodes]);

  // Запустити одну ноду (кнопка ▶ на ноді)
  const handleRunNode = useCallback((nodeId: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Читаємо актуальні nodes/edges з ref — без stale closure
      const node = nodesRef.current.find(x => x.id === nodeId);
      if (node) ws.send(JSON.stringify({ type: 'RUN_SINGLE_NODE', node, nodes: nodesRef.current, edges: edgesRef.current }));
    } else {
      alert('WebSocket не підключено. Перевірте що бекенд запущено.');
    }
  }, []);

  // Видалити ноду та всі з'єднані лінії
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Переключити міні-режим
  const handleToggleMini = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((n) => 
      n.id === nodeId ? { ...n, data: { ...n.data, miniCollapsed: !n.data.miniCollapsed } } : n
    ));
  }, [setNodes]);

  // Змінити іконку ноди
  const handleSetCustomIcon = useCallback((nodeId: string, iconName: string) => {
    setNodes((nds) => nds.map((n) => 
      n.id === nodeId ? { ...n, data: { ...n.data, customIcon: iconName } } : n
    ));
    setMenu(null);
  }, [setNodes]);

  // Підключаємо колбеки до кожної ноди при їх зміні
  const attachCallbacks = useCallback((nds: Node[]) => {
    return nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        onPickElement: handlePickElement,
        onDataChange: handleDataChange,
        onRunNode: handleRunNode,
        onDeleteNode: handleDeleteNode,
        onToggleMini: handleToggleMini,
        onSetCustomIcon: handleSetCustomIcon,
      }
    }));
  }, [handlePickElement, handleDataChange, handleRunNode, handleDeleteNode, handleToggleMini, handleSetCustomIcon]);

  // З'єднання між нодами
  const onConnect = useCallback((params: Connection | Edge) => {
    const newEdge = {
      ...params,
      type: 'delayEdge',
      data: {
        delay: 0,
        onDelayChange: (edgeId: string, newDelay: number) => {
          setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, delay: newDelay } } : e)));
        },
        onDelete: (edgeId: string) => {
          setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        }
      }
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Додавання ноди через drag-n-drop із сайдбару
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

    const newNode: Node = {
      id: getId(),
      type,
      position,
      dragHandle: '.drag-handle',
      data: {
        label: type === 'apiNode' ? 'API' :
               type === 'variableNode' ? 'Пам\'ять' :
               type === 'valueLoopNode' ? 'Цикл' :
               type === 'multiLogicNode' ? 'ХАБ' :
               type === 'actionNode' ? 'Дія' :
               type === 'conditionNode' ? 'Умова' :
               type === 'browserNode' ? 'Браузер' :
               type === 'infoNode' ? 'Сканер' :
               type === 'displayNode' ? 'Вивід' :
               type === 'imageSearchNode' ? 'Пошук картинки' :
               type === 'selectorCheckNode' ? 'Перевірка' :
               type === 'nestedCheckNode' ? 'Вкладена' :
               type === 'multiScanNode' ? 'Мульти-Сканер' :
               type === 'keyboardNode' ? 'Макрос' :
               type === 'visualSearchNode' ? 'Зір' :
               type === 'coordClickNode' ? 'Клік (X,Y)' :
               type === 'compareNode' ? 'Порівняння' :
               type === 'searchInNode' ? 'Пошук у блоці' : 'Затримка',
        selector: '',
        url: type === 'apiNode' ? 'https://api.sunflower-land.com/farm/status' : undefined,
        apiKey: type === 'apiNode' ? '' : undefined,
        variables: type === 'variableNode' ? [{ name: 'gold', path: 'balance' }] : undefined,
        conditions: type === 'multiLogicNode' ? [{ expression: 'gold > 100' }] : undefined,
        keys: type === 'keyboardNode' ? [{ key: 'Enter', delay: 100 }] : undefined,
        // Колбеки — читають ws/nodes/edges з refs, не stale closure
        onPickElement: handlePickElement,
        onDataChange: handleDataChange,
        onRunNode: handleRunNode,
        onDeleteNode: handleDeleteNode,
        onToggleMini: handleToggleMini,
      },
    };
    const currentNodes = reactFlowInstance.getNodes();
    setNodes([...currentNodes, newNode]);
  }, [reactFlowInstance, setNodes, handlePickElement, handleDataChange, handleRunNode, handleDeleteNode, handleToggleMini]);

  // Обробник мобільного тапу — додає ноду по центру полотна
  useEffect(() => {
    const handleTapAdd = (e: any) => {
      const type = e.detail?.type;
      if (!type || !reactFlowInstance) return;

      // Визначаємо центр поточного viewport
      reactFlowInstance.getViewport();
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      // Центр екрану у координатах ReactFlow
      const position = reactFlowInstance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        dragHandle: '.drag-handle',
        data: {
          label: type === 'apiNode' ? 'API' :
                 type === 'variableNode' ? 'Пам\'ять' :
                 type === 'valueLoopNode' ? 'Цикл' :
                 type === 'multiLogicNode' ? 'ХАБ' :
                 type === 'actionNode' ? 'Дія' :
                 type === 'conditionNode' ? 'Умова' :
                 type === 'browserNode' ? 'Браузер' :
                 type === 'infoNode' ? 'Сканер' :
                 type === 'displayNode' ? 'Вивід' :
                 type === 'imageSearchNode' ? 'Пошук картинки' :
                 type === 'selectorCheckNode' ? 'Перевірка' :
                 type === 'nestedCheckNode' ? 'Вкладена' :
                 type === 'keyboardNode' ? 'Макрос' :
                 type === 'visualSearchNode' ? 'Зір' :
                 type === 'coordClickNode' ? 'Клік (X,Y)' :
                 type === 'compareNode' ? 'Порівняння' :
                 type === 'searchInNode' ? 'Пошук у блоці' : 'Затримка',
          selector: '',
          url: type === 'apiNode' ? 'https://api.sunflower-land.com/visit/734393424627289' : undefined,
          apiKey: type === 'apiNode' ? '' : undefined,
          variables: type === 'variableNode' ? [{ name: 'gold', path: 'balance' }] : undefined,
          conditions: type === 'multiLogicNode' ? [{ rules: [{ varName: '', op: '>', value: '0' }], logicOp: '&&', expression: '' }] : undefined,
          keys: type === 'keyboardNode' ? [{ key: 'Enter', delay: 100 }] : undefined,
          onPickElement: handlePickElement,
          onDataChange: handleDataChange,
          onRunNode: handleRunNode,
          onDeleteNode: handleDeleteNode,
          onToggleMini: handleToggleMini,
        },
      };
      const currentNodes = reactFlowInstance.getNodes();
      setNodes([...currentNodes, newNode]);
    };

    window.addEventListener('add-node-tap', handleTapAdd);
    return () => window.removeEventListener('add-node-tap', handleTapAdd);
  }, [reactFlowInstance, setNodes, handlePickElement, handleDataChange, handleRunNode, handleDeleteNode, handleToggleMini]);

  // Автоматичне завантаження при старті (ОДИН раз)
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const res = await fetch(`${API_HOST}/api/load`);
        const data = await res.json();
        if (data.nodes && data.nodes.length > 0) {
          // Використовуємо уніфіковану функцію для підключення всіх колбеків
          setNodes(attachCallbacks(data.nodes));
          
          // Підключаємо колбеки до ліній (edges)
          const loadedEdges = (data.edges || []).map((edge: any) => ({
            ...edge,
            data: {
              ...edge.data,
              onDelayChange: (edgeId: string, newDelay: number) => {
                setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, delay: newDelay } } : e)));
              },
              onDelete: (edgeId: string) => {
                setEdges((eds) => eds.filter((e) => e.id !== edgeId));
              }
            }
          }));
          setEdges(loadedEdges);
        } else {
          // Якщо сервер порожній - ставимо початкову ноду з колбеками
          setNodes(attachCallbacks(initialNodes));
        }
      } catch (e) { 
        console.error('Load error:', e); 
        // При помилці завантаження теж ставимо початкову ноду
        setNodes(attachCallbacks(initialNodes));
      }
    };
    loadInitial();
  }, [attachCallbacks, setNodes, setEdges]);
  
  // Копіювання та вставка
  const onCopy = useCallback(() => {
    const selectedNodes = nodesRef.current.filter(n => n.selected);
    const selectedEdges = edgesRef.current.filter(e => e.selected);
    if (selectedNodes.length > 0) {
      setClipboard({ nodes: JSON.parse(JSON.stringify(selectedNodes)), edges: JSON.parse(JSON.stringify(selectedEdges)) });
    }
  }, []);

  const onPaste = useCallback((pos?: { x: number, y: number }) => {
    if (!clipboard) return;
    const offset = { x: 50, y: 50 };
    const idMap: Record<string, string> = {};
    
    // Якщо позиція не вказана - використовуємо зміщення від оригіналу
    // Якщо вказана - центруємо групу нод у точці кліку
    let basePos = { x: 0, y: 0 };
    if (pos && clipboard.nodes.length > 0) {
      basePos = { x: pos.x, y: pos.y };
      // Знаходимо центр групи для точного вставляння
      const minX = Math.min(...clipboard.nodes.map(n => n.position.x));
      const minY = Math.min(...clipboard.nodes.map(n => n.position.y));
      clipboard.nodes.forEach(n => {
         n.position.x = n.position.x - minX + basePos.x;
         n.position.y = n.position.y - minY + basePos.y;
      });
    }

    const newNodes = clipboard.nodes.map(node => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap[node.id] = newId;
      return {
        ...node,
        id: newId,
        position: pos ? { x: node.position.x, y: node.position.y } : { x: node.position.x + offset.x, y: node.position.y + offset.y },
        selected: true,
      };
    });

    const newEdges = clipboard.edges.map(edge => ({
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      source: idMap[edge.source] || edge.source,
      target: idMap[edge.target] || edge.target,
      selected: true,
    })).filter(e => idMap[e.source] && idMap[e.target]);

    setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(attachCallbacks(newNodes)));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));
    setMenu(null);
  }, [clipboard, setNodes, setEdges, attachCallbacks]);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, type: 'pane' });
  }, []);

  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    event.preventDefault();
    // Якщо нода не виділена - виділяємо її одну
    if (!node.selected) {
      setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
    }
    setMenu({ x: event.clientX, y: event.clientY, type: 'node', nodeId: node.id });
  }, [setNodes]);

  const onPaneClick = useCallback(() => setMenu(null), []);

  const onDeleteSelected = useCallback(() => {
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => eds.filter(e => !e.selected));
    setMenu(null);
  }, [setNodes, setEdges]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      onCopy();
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      onPaste();
      e.preventDefault();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') return;
      setNodes(nds => nds.filter(n => !n.selected));
      setEdges(eds => eds.filter(e => !e.selected));
    }
  }, [onCopy, onPaste, setNodes, setEdges]);

  // Запуск повного сценарію бота
  const runBot = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Читаємо актуальні nodes/edges з refs — без stale closure
      ws.send(JSON.stringify({ type: 'RUN_BOT', nodes: nodesRef.current, edges: edgesRef.current }));
    } else {
      alert('WebSocket не підключено. Перевірте що бекенд (npm run dev у папці backend) запущено на порту 3002.');
    }
  }, []);

  // Підсвітка ліній при виділенні нод
  const onSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    const selectedNodeIds = new Set(params.nodes.map((n) => n.id));
    
    setEdges((eds) =>
      eds.map((edge) => {
        const isConnected = selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);
        return {
          ...edge,
          animated: isConnected,
          style: {
            ...edge.style,
            stroke: isConnected ? '#3b82f6' : (theme === 'dark' ? '#334155' : '#cbd5e1'),
            strokeWidth: isConnected ? 3 : 1.5,
            opacity: isConnected ? 1 : 0.4,
          },
        };
      })
    );
  }, [setEdges, theme]);

  const saveProject = async (name: string = 'default') => {
    try {
      await fetch(`${API_HOST}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: { nodes: nodesRef.current, edges: edgesRef.current } }),
      });
    } catch (e) { console.error('Помилка збереження:', e); }
  };

  const loadProject = async (name: string = 'default') => {
    try {
      const res = await fetch(`${API_HOST}/api/load?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setNodes(attachCallbacks(data.nodes));
      
      const loadedEdges = (data.edges || []).map((edge: any) => ({
        ...edge,
        data: {
          ...edge.data,
          onDelayChange: (edgeId: string, newDelay: number) => {
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, delay: newDelay } } : e)));
          },
          onDelete: (edgeId: string) => {
            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
          }
        }
      }));
      setEdges(loadedEdges);
    } catch (e) { console.error('Помилка завантаження:', e); }
  };

  return (
    <div className={`flex flex-col w-full h-full ${theme}`}>
      {/* Плаваюча кнопка Запуску (Справа зверху) */}
      <div className="fixed top-4 right-4 z-[100] flex items-center gap-3">
        {isBotRunning && (
          <div className="flex flex-col items-end mr-1 hidden md:flex">
             <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-background/50 backdrop-blur-sm border border-border/50 text-green-500 animate-pulse">
               Бот в ефірі
             </span>
          </div>
        )}
        
        <button
          onClick={() => {
            if (isBotRunning) {
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'STOP_BOT' }));
              }
              setIsBotRunning(false);
            } else {
              runBot();
              setIsBotRunning(true);
            }
          }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-xl active:scale-95 border-2 border-background/20 backdrop-blur-sm ${
            isBotRunning 
              ? 'bg-destructive text-destructive-foreground rotate-0 scale-110' 
              : 'bg-primary/40 text-primary-foreground hover:bg-primary/80 opacity-60 hover:opacity-100'
          }`}
          title={isBotRunning ? "Зупинити бота" : "Запустити бота"}
        >
          {isBotRunning ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
        </button>
      </div>

      <div className="flex flex-row w-full flex-1 overflow-hidden relative" style={{ height: 'calc(100vh - 56px)' }}>
        {/* ЄДИНИЙ САЙДБАР (Для всіх пристроїв) */}
        <div className="w-fit h-full border-r border-border bg-card shrink-0 z-50">
          <Sidebar 
            onSave={saveProject}
            onLoad={loadProject}
            onClear={() => { setNodes([]); setEdges([]); }}
            onSettingsToggle={() => setShowSettings(true)}
          />
        </div>

        <ReactFlowProvider>
          <div className="flex-1 h-full relative overflow-hidden" ref={reactFlowWrapper}>
            <GlobalSettings forceOpen={showSettings} onOpenChange={setShowSettings} />
            
            {pickerConfig && (
              <StreamPicker 
                ws={wsRef.current}
                nodeId={pickerConfig.nodeId}
                pickType={pickerConfig.pickType}
                onClose={() => setPickerConfig(null)}
              />
            )}

            {/* Кнопка швидкого доступу до браузера */}
            <button
              onClick={() => setPickerConfig({ nodeId: 'remote_browser', pickType: 'default' })}
              className="fixed bottom-20 right-6 z-[100] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all group border-2 border-white/20 backdrop-blur-sm"
              title="Відкрити віддалене керування"
            >
              <Globe size={26} className="group-hover:rotate-12 transition-transform" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
              <span className="absolute right-full mr-3 px-2 py-1 bg-black/80 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
                Браузер
              </span>
            </button>

            {/* Консоль дебагу */}
            <div className={`fixed bottom-0 left-0 right-0 z-[110] transition-all duration-300 ease-in-out ${isConsoleOpen ? 'h-[350px]' : 'h-10'} bg-background/90 backdrop-blur-2xl border-t border-border shadow-2xl flex flex-col`}>
              {/* Шапка консолі */}
              <div className="flex items-center justify-between px-4 h-10 border-b border-border/50">
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1 h-full"
                  onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                >
                  <div className={`p-1 rounded ${isConsoleOpen ? 'bg-indigo-500 text-white' : 'text-muted-foreground'}`}>
                    <Terminal size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    Консоль
                    {logs.length > 0 && (
                      <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-1.5 py-0.5 rounded-full">
                        {logs.length}
                      </span>
                    )}
                  </span>
                </div>

                {isConsoleOpen && (
                  <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg mr-4">
                    <button 
                      onClick={() => setActiveTab('logs')}
                      className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-background text-indigo-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Terminal size={12} /> Логи
                    </button>
                    <button 
                      onClick={() => setActiveTab('photos')}
                      className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'photos' ? 'bg-background text-indigo-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Camera size={12} /> Фото дебагу
                      {debugImages.length > 0 && (
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                      )}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-4">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setLogs([]); setDebugImages([]); }}
                     className="text-muted-foreground hover:text-destructive transition-colors p-1"
                     title="Очистити все"
                   >
                     <Trash2 size={14} />
                   </button>
                   <div 
                     className="text-muted-foreground cursor-pointer"
                     onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                   >
                     {isConsoleOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                   </div>
                </div>
              </div>

              {/* Тіло консолі */}
              {isConsoleOpen && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {activeTab === 'logs' ? (
                    <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 custom-scrollbar bg-black/20">
                      {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 italic">
                           <Terminal size={32} className="mb-2 opacity-20" />
                           Чекаємо на події...
                        </div>
                      ) : (
                        logs.map((log) => (
                          <div key={log.id} className="group border-b border-white/5 last:border-0 pb-1">
                            <div className="flex gap-3 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                              <span className="text-muted-foreground/50 shrink-0 w-16">{log.time}</span>
                              <span className={`shrink-0 w-16 font-bold uppercase text-[9px] mt-0.5 ${
                                log.type === 'error' ? 'text-red-500' : 
                                log.type === 'success' ? 'text-green-500' : 
                                log.type === 'debug' ? 'text-purple-500' : 
                                'text-blue-500'
                              }`}>
                                [{log.type}]
                              </span>
                              <span className={`flex-1 break-all ${
                                log.type === 'error' ? 'text-red-400' : 
                                log.type === 'success' ? 'text-green-400' : 
                                'text-foreground/90'
                              }`}>
                                {log.message}
                              </span>
                            </div>
                            {log.data && (
                              <div className="ml-20 mb-2 p-2 bg-black/40 rounded-lg border border-white/5 overflow-x-auto">
                                <pre className="text-[9px] text-indigo-300/80">
                                  {JSON.stringify(log.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
                       {debugImages.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 italic">
                            <ImageIcon size={32} className="mb-2 opacity-20" />
                            Скріншотів поки немає...
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {debugImages.map((img) => (
                              <div key={img.id} className="bg-muted/30 border border-border/50 rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all shadow-lg">
                                 <div className="relative aspect-video bg-black/40">
                                    <img src={img.image} className="w-full h-full object-contain" alt="Debug View" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                 </div>
                                 <div className="p-2.5 flex items-center justify-between border-t border-border/50 bg-background/50">
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-black uppercase text-indigo-400 tracking-tighter truncate max-w-[150px]">
                                          {img.nodeName}
                                       </span>
                                       <span className="text-[8px] text-muted-foreground">{img.time}</span>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = img.image;
                                        link.download = `debug_${img.id}.png`;
                                        link.click();
                                      }}
                                      className="p-1.5 hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-400 rounded-lg transition-colors"
                                    >
                                       <ImageIcon size={14} />
                                    </button>
                                 </div>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              snapToGrid={snapToGrid}
              snapGrid={[20, 20]}
              onNodeClick={(_, node) => {
                // Примусово оновлюємо підсвітку при кліку
                onSelectionChange({ nodes: [node], edges: [] });
              }}
              onInit={(instance) => {
                setReactFlowInstance(instance);
                (window as any).rfInstance = instance;
              }}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              colorMode={theme}
              zoomOnScroll={true}
              panOnScroll={false}
              panOnDrag={true} 
              selectionOnDrag={false}
              selectionMode={SelectionMode.Partial}
              selectionKeyCode={null}
              onKeyDown={onKeyDown}
              fitView
              onPaneContextMenu={onPaneContextMenu}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onPaneContextMenu}
              onSelectionContextMenu={onPaneContextMenu}
              onPaneClick={onPaneClick}
              minZoom={0.05}
              maxZoom={3}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} style={{ backgroundColor: 'hsl(var(--global-map-color))' }} />
              <Controls />
              
              {/* Контекстне меню */}
              {menu && (
                <div 
                  className="fixed bg-card shadow-2xl rounded-lg border border-border p-1.5 z-[100] min-w-[180px] animate-in fade-in zoom-in duration-100 text-card-foreground"
                  style={{ top: menu.y, left: menu.x }}
                  onClick={e => e.stopPropagation()}
                >
                  <button 
                    onClick={onCopy}
                    disabled={nodes.filter(n => n.selected).length === 0}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    <Copy size={14} className="text-muted-foreground" />
                    <span>Копіювати</span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">Ctrl+C</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                       const rfInstance = (window as any).rfInstance;
                       if (rfInstance) {
                         const position = rfInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
                         onPaste(position);
                       } else {
                         onPaste();
                       }
                    }}
                    disabled={!clipboard}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    <ArrowRightLeft size={14} className="text-muted-foreground" />
                    <span>Вставити {clipboard ? `(${clipboard.nodes.length})` : ''}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">Ctrl+V</span>
                  </button>
                  
                  <div className="h-px bg-border my-1" />
                  
                  {menu.type === 'node' && (
                    <div className="px-1 py-1">
                      <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-muted-foreground/60 flex items-center gap-2">
                        <Smile size={12} /> Змінити іконку
                      </div>
                      <div className="grid grid-cols-6 gap-1 p-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {['Zap', 'Target', 'Smile', 'Heart', 'Star', 'Bell', 'Camera', 'Cloud', 'Ghost', 'Gift', 'Home', 'Image', 'Key', 'Lock', 'Mail', 'Map', 'Music', 'Phone', 'Rocket', 'Search', 'Settings2', 'Shield', 'ShoppingCart', 'Terminal', 'User', 'Video', 'Wifi'].map(iconName => (
                          <button
                            key={iconName}
                            onClick={() => handleSetCustomIcon(menu.nodeId!, iconName)}
                            className="p-1.5 hover:bg-muted rounded flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
                            title={iconName}
                          >
                            {(() => {
                              const IconComp = (LucideIcons as any)[iconName];
                              return IconComp ? React.createElement(IconComp, { size: 14 }) : null;
                            })()}
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-border my-1" />
                    </div>
                  )}

                  <button 
                    onClick={onDeleteSelected}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Видалити</span>
                    <span className="ml-auto text-[10px] opacity-60">Del</span>
                  </button>
                </div>
              )}
            </ReactFlow>
          </div>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default NodeEditor;
