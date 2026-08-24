import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Globe // Імпортуємо лише іконку Globe, інші іконки використовуються через LucideIcons
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
import CoordOffsetNode from './CustomNodes/CoordOffsetNode';
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
import GateNode from './CustomNodes/GateNode';
import EscNode from './CustomNodes/EscNode';
import CommentNode from './CustomNodes/CommentNode';
import RandomDelayNode from './CustomNodes/RandomDelayNode';
import EventVariationsNode from './CustomNodes/EventVariationsNode';
import CalculatorNode from './CustomNodes/CalculatorNode';
import VariablesMonitorNode from './CustomNodes/VariablesMonitorNode';
import RotatorNode from './CustomNodes/RotatorNode';
import GroupNode from './CustomNodes/GroupNode';
import SubEntryNode from './CustomNodes/SubEntryNode';
import SubExitNode from './CustomNodes/SubExitNode';
import CooldownNode from './CustomNodes/CooldownNode';
import SetNextRunNode from './CustomNodes/SetNextRunNode';
import NotifyNode from './CustomNodes/NotifyNode';
import CropAnalyzerNode from './CustomNodes/CropAnalyzerNode';
import FirePitNode from './CustomNodes/FirePitNode';
import KitchenNode from './CustomNodes/KitchenNode';
import DeliNode from './CustomNodes/DeliNode';
import SmoothieShackNode from './CustomNodes/SmoothieShackNode';
import BakeryNode from './CustomNodes/BakeryNode';
import InventoryScannerNode from './CustomNodes/InventoryScannerNode';
import ScreenshotNode from './CustomNodes/ScreenshotNode';
import MemoryGameNode from './CustomNodes/MemoryGameNode'; // Нода Гра Пам'ять
import WhackAMoleNode from './CustomNodes/WhackAMoleNode'; // Нода Вдарь Крота
// Імпортуємо новий компонент для введення тексту та кліку
import SearchAndClickNode from './CustomNodes/SearchAndClickNode';
import ConfigNode from './CustomNodes/ConfigNode';
import IslandArrangerNode from './CustomNodes/IslandArrangerNode';
import TextInputNode from './CustomNodes/TextInputNode';
import FlowerPlanterNode from './CustomNodes/FlowerPlanterNode';
import DeliveryNode from './CustomNodes/DeliveryNode';
import FoodNode from './CustomNodes/FoodNode';
import { RoninWalletNode } from './CustomNodes/RoninWalletNode';
import DelayEdge from './DelayEdge';
import GlobalSettings from './GlobalSettings';
import Sidebar from './Sidebar';
import StreamPicker from './StreamPicker';
import { GlobalStatisticsModal } from './GlobalStatisticsModal';
import { PortTooltipManager } from './PortTooltipManager';
import { NODE_CONFIG } from '../nodeConfig';
import { ConsolePane } from './ConsolePane';
import { NodeContextMenu } from './ui/NodeContextMenu';
import ProjectManagerModal from './ProjectManagerModal'; // Менеджер проектів
import ScheduleManager from './ScheduleManager';
import { IslandMapModal } from './Map/IslandMapModal'; // Менеджер розкладу
import { DeliveriesModal } from './Modals/DeliveriesModal';
import { AllDeliveriesModal } from './Modals/AllDeliveriesModal';
import { AllScreenshotsModal } from './Modals/AllScreenshotsModal';
import { AllInventoriesModal } from './Modals/AllInventoriesModal';
import { InventoryModal } from './InventoryModal'; // Модалка інвентаря
import ScreenshotSidebar from './ScreenshotSidebar'; // Панель скріншотів

import { useWebSocket } from '../hooks/useWebSocket';
import { useProjectManager } from '../hooks/useProjectManager';
import { useAutoSave } from '../hooks/useAutoSave';
import { useClipboard } from '../hooks/useClipboard';
import { useCanvasActions } from '../hooks/useCanvasActions';
import { useHistory } from '../hooks/useHistory';

const nodeTypes = {
  actionNode: ActionNode,
  startNode: StartNode,
  coordOffsetNode: CoordOffsetNode,
  conditionNode: CompareNode,
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
  gateNode: GateNode,
  escNode: EscNode,
  commentNode: CommentNode,
  randomDelayNode: RandomDelayNode,
  eventVariationsNode: EventVariationsNode,
  calculatorNode: CalculatorNode,
  variablesMonitorNode: VariablesMonitorNode,
  rotatorNode: RotatorNode,
  groupNode: GroupNode,
  subEntryNode: SubEntryNode,
  subExitNode: SubExitNode,
  cooldownNode: CooldownNode,
  setNextRunNode: SetNextRunNode,
  notifyNode: NotifyNode,
  cropAnalyzerNode: CropAnalyzerNode,
  firePitNode: FirePitNode,
  kitchenNode: KitchenNode,
  deliNode: DeliNode,
  smoothieShackNode: SmoothieShackNode,
  bakeryNode: BakeryNode,
  inventoryScannerNode: InventoryScannerNode,
  screenshotNode: ScreenshotNode,
  memoryGameNode: MemoryGameNode,  // Гра Пам'ять
  whackAMoleNode: WhackAMoleNode,  // Гра Вдарь Крота
  searchAndClickNode: SearchAndClickNode,
  configNode: ConfigNode,
  islandArrangerNode: IslandArrangerNode,
  textInputNode: TextInputNode,
  flowerPlanterNode: FlowerPlanterNode,
  deliveryNode: DeliveryNode,
  foodNode: FoodNode,
  roninWalletNode: RoninWalletNode,
};

const edgeTypes = {
  delayEdge: DelayEdge,
};

// Змінна для генерації унікальних ID нод
let id = Date.now();
// Функція для генерації унікального ID ноди
const getId = () => `node_${id++}_${Math.random().toString(36).substr(2, 4)}`;

// Функція для отримання хоста API
const getApiHost = () => "";
// Функція для формування адреси WebSocket із додаванням назви проекту
const getWsHost = (projectName: string) => {
  const { protocol, host } = window.location;
  // Додаємо параметр project в query string
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/ws?project=${encodeURIComponent(projectName)}`;
};

// Задаємо базову адресу API
const API_HOST = getApiHost();
// Масив ID системних нод, які не можна видаляти
const PROTECTED_IDS = ['start_node'];

interface NodeEditorProps {
  currentView: string;
  setCurrentView: (view: any) => void;
}

const NodeEditor = ({ currentView, setCurrentView }: NodeEditorProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [debugImages, setDebugImages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'photos' | 'notifications'>('logs');
  // Термінал за замовчуванням згорнутий — зберігаємо стан у localStorage
  const [isConsoleOpen, setIsConsoleOpen] = useState(() => {
    // Зчитуємо збережений стан відкритості терміналу або закриваємо за замовчуванням
    const saved = localStorage.getItem('sfl_console_open');
    // Якщо збереженого значення немає — за замовчуванням false (згорнутий)
    return saved !== null ? saved === 'true' : false;
  });

  // === Збереження логів окремо для кожного проекту ===
  // Карта для зберігання логів кожного проекту (ключ — назва проекту)
  const projectLogsRef = useRef<Map<string, any[]>>(new Map());
  // Карта для зберігання скріншотів дебагу кожного проекту
  const projectImagesRef = useRef<Map<string, any[]>>(new Map());
  // Ref для доступу до поточних логів (потрібен для збереження при зміні проекту)
  const logsRef = useRef(logs);
  // Синхронізація ref логів з актуальним стейтом після кожного рендеру
  useEffect(() => { logsRef.current = logs; }, [logs]);
  // Ref для доступу до поточних скріншотів дебагу
  const debugImagesRef = useRef(debugImages);
  // Синхронізація ref скріншотів з актуальним стейтом після кожного рендеру
  useEffect(() => { debugImagesRef.current = debugImages; }, [debugImages]);
  
  const [globalVariables, setGlobalVariables] = useState<Record<string, any>>({});
  const globalVariablesRef = useRef(globalVariables);
  useEffect(() => { globalVariablesRef.current = globalVariables; }, [globalVariables]);

  const wsRef = useRef<WebSocket | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const selectedNodesRef = useRef<any[]>([]);
  
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  const { onCopy: onCopyRaw, getPasteData } = useClipboard();

  // Додаємо ref для attachCallbacks, щоб розірвати циклічну залежність
  const attachCallbacksRef = useRef<(nds: Node[]) => Node[]>((nds) => nds);

  // Ініціалізуємо useHistory до того, як takeSnapshot буде використано в useCallback
  const { takeSnapshot } = useHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
    useCallback((nds: Node[]) => attachCallbacksRef.current(nds), [])
  );

  const [menu, setMenu] = useState<{ x: number, y: number, type: 'pane' | 'node' | 'selection', nodeId?: string, hasSelection?: boolean } | null>(null);
  const [theme] = useState<'light' | 'dark'>('dark'); 
  const [isBotRunning, setIsBotRunning] = useState(false);
  // Бокова панель за замовчуванням згорнута — зберігаємо стан у localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Зчитуємо збережений стан згорнутості сайдбару або згортаємо за замовчуванням
    const saved = localStorage.getItem('sfl_sidebar_collapsed');
    // Якщо збереженого значення немає — за замовчуванням true (згорнутий)
    return saved !== null ? saved === 'true' : true;
  });

  const subNodeCallbacksRef = useRef<Map<string, (data: any) => void>>(new Map());
  const [showSettings, setShowSettings] = useState(false);
  const [showGlobalStats, setShowGlobalStats] = useState(false);
  const [pickerConfig, setPickerConfig] = useState<{ nodeId: string, pickType: string, wsUrl?: string } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  useEffect(() => { selectedNodesRef.current = selectedNodes; }, [selectedNodes]);
  const [globalSettings, setGlobalSettings] = useState(() => {
    const saved = localStorage.getItem('sfl_global_settings_v4');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const handleSettingsChanged = (e: any) => setGlobalSettings(e.detail);
    window.addEventListener('global-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChanged);
  }, []);

  const snapToGrid = globalSettings.snapToGrid !== false;
  // Стан відображення менеджера проектів
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isScheduleManagerOpen, setIsScheduleManagerOpen] = useState(false);
  // Стан відображення модалки інвентаря
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isDeliveriesOpen, setIsDeliveriesOpen] = useState(false);
  const [isAllDeliveriesOpen, setIsAllDeliveriesOpen] = useState(false);
  const [isAllScreenshotsOpen, setIsAllScreenshotsOpen] = useState(false);
  const [isAllInventoriesOpen, setIsAllInventoriesOpen] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
  // Стан відображення панелі скріншотів
  const [isScreenshotSidebarCollapsed, setIsScreenshotSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sfl_screenshot_sidebar_collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('sfl_screenshot_sidebar_collapsed', String(isScreenshotSidebarCollapsed));
  }, [isScreenshotSidebarCollapsed]);
  // Ініціалізуємо поточний проект, пріоритетно зчитуючи його з query-параметра URL, потім з localStorage
  const [currentProject, setCurrentProject] = useState<string>(() => {
    // Створюємо об'єкт для роботи з query-параметрами поточного URL
    const params = new URLSearchParams(window.location.search);
    // Намагаємось отримати значення параметра 'project'
    const projParam = params.get('project');
    // Якщо параметр задано та він не порожній
    if (projParam && projParam.trim() !== '') {
      // Зберігаємо це значення у локальне сховище браузера
      localStorage.setItem('sfl_current_project', projParam);
      // Повертаємо назву проекту
      return projParam;
    } // Закриваємо умову перевірки параметра
    // Якщо в URL немає, пробуємо зчитати з локального сховища
    const savedProj = localStorage.getItem('sfl_current_project');
    // Якщо знайдено збережений проект
    if (savedProj && savedProj.trim() !== '') {
      // Повертаємо його
      return savedProj;
    } // Закриваємо умову перевірки сховища
    // Повертаємо 'default' за замовчуванням
    return 'default';
  }); // Закриваємо useState поточного проекту


  // Формуємо поточний хост для WebSocket-з'єднання з урахуванням обраного проекту
  const WS_HOST = getWsHost(currentProject);

  // Ref для збереження назви попереднього проекту при перемиканні
  const prevProjectRef = useRef<string>(currentProject);

  // Функція для завантаження збережених логів проекту з бекенду (файлова система)
  const fetchProjectLogs = useCallback(async (projectName: string) => {
    try {
      // Надсилаємо GET-запит до ендпоінту збережених логів проекту
      const res = await fetch(`/api/logs/${encodeURIComponent(projectName)}`);
      // Якщо запит успішний
      if (res.ok) {
        // Парсимо JSON-масив логів з відповіді сервера
        const savedLogs = await res.json();
        // Якщо сервер повернув непустий масив логів
        if (Array.isArray(savedLogs) && savedLogs.length > 0) {
          // Встановлюємо збережені логи як початкові (вони вже в порядку найновіші спочатку)
          setLogs(savedLogs);
          // Також кешуємо їх у Map для швидкого перемикання без мережі
          projectLogsRef.current.set(projectName, savedLogs);
        }
      }
    } catch {
      // Помилки мережі ігноруємо — покажемо кешовані логи або пустий масив
    }
  }, []);

  // Ефект для збереження та відновлення логів при зміні поточного проекту
  useEffect(() => {
    // Отримуємо назву попереднього проекту з ref
    const prevProject = prevProjectRef.current;
    // Якщо проект дійсно змінився (а не просто перерендер)
    if (prevProject !== currentProject) {
      // Зберігаємо логи попереднього проекту в карту за його назвою
      projectLogsRef.current.set(prevProject, logsRef.current);
      
      // Відправляємо логи попереднього проекту на сервер для збереження
      fetch(`/api/logs/${encodeURIComponent(prevProject)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logsRef.current)
      }).catch(() => {});

      // Зберігаємо скріншоти дебагу попереднього проекту в карту
      projectImagesRef.current.set(prevProject, debugImagesRef.current);
      // Миттєво встановлюємо кешовані логи нового проекту (або пустий масив)
      setLogs(projectLogsRef.current.get(currentProject) || []);
      // Відновлюємо збережені скріншоти дебагу нового проекту (або пустий масив)
      setDebugImages(projectImagesRef.current.get(currentProject) || []);
      // Оновлюємо ref попереднього проекту на актуальну назву
      prevProjectRef.current = currentProject;
      // Фоново завантажуємо збережені логи з файлу на сервері
      fetchProjectLogs(currentProject);
    }
  }, [currentProject, fetchProjectLogs]); // Ефект виконується кожного разу при зміні поточного проекту

  // Ефект для збереження логів при події sfl-save-logs (викликається з useProjectManager)
  useEffect(() => {
    const handleSaveLogs = (e: Event) => {
      const customEvent = e as CustomEvent;
      const projectName = customEvent.detail?.projectName || currentProject;
      
      // Відправляємо поточні логи на сервер
      fetch(`/api/logs/${encodeURIComponent(projectName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logsRef.current)
      }).catch(() => {});
    };

    window.addEventListener('sfl-save-logs', handleSaveLogs);
    return () => window.removeEventListener('sfl-save-logs', handleSaveLogs);
  }, [currentProject]);

  // Ефект для завантаження збережених логів при першому завантаженні сторінки
  useEffect(() => {
    // Завантажуємо логи поточного проекту з бекенду при ініціалізації
    fetchProjectLogs(currentProject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Виконується тільки один раз при монтуванні компонента

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' | 'debug' = 'info', data?: any) => {
    setLogs(prev => [{ id: Date.now().toString() + Math.random(), time: new Date().toLocaleTimeString(), type, message, data }, ...prev.slice(0, 299)]);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const protectedCount = deletedNodes.filter(n => PROTECTED_IDS.includes(n.id)).length;
    if (protectedCount > 0) addLog('Помилка: Неможливо видалити системну ноду', 'error');
  }, [addLog]);

  const handleDataChange = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
  }, [setNodes]);

  const handleRunNode = useCallback((nodeId: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const node = nodesRef.current.find(x => x.id === nodeId);
      if (node) {
        const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
        const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
        const projName = localStorage.getItem('sfl_current_project') || 'default';
        const savedBrowser = localStorage.getItem(`sfl_browser_${projName}`);
        const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
        const settings = { ...globalSettings, ...browserSettings };
        ws.send(JSON.stringify({ type: 'RUN_SINGLE_NODE', node, nodes: nodesRef.current, edges: edgesRef.current, settings }));
      }
    }
  }, []);

  const handleRunSubNode = useCallback((nodeId: string, subNodes: any[], subEdges: any[]) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const node = subNodes.find((x: any) => x.id === nodeId);
      if (node) {
        const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
        const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
        const projName = localStorage.getItem('sfl_current_project') || 'default';
        const savedBrowser = localStorage.getItem(`sfl_browser_${projName}`);
        const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
        const settings = { ...globalSettings, ...browserSettings };
        ws.send(JSON.stringify({ type: 'RUN_SINGLE_NODE', node, nodes: subNodes, edges: subEdges, settings }));
      }
    }
  }, []);

  const handleRunGroup = useCallback((_groupId: string, subNodes: any[], subEdges: any[]) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
      const projName = localStorage.getItem('sfl_current_project') || 'default';
      const savedBrowser = localStorage.getItem(`sfl_browser_${projName}`);
      const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
      delete browserSettings.photoDebug;
      delete browserSettings.snapToGrid;
      const settings = { ...globalSettings, ...browserSettings };
      ws.send(JSON.stringify({
        type: 'RUN_GROUP',
        nodes: subNodes || [],
        edges: subEdges || [],
        globalVariables: globalVariablesRef.current,
        settings
      }));
      setIsBotRunning(true);
      addLog('Запуск контейнера...', 'success');
    }
  }, [addLog]);

  const handlePickElement = useCallback((nodeId: string, pickType: string, subNodeUpdateCb?: (data: any) => void) => {
    if (subNodeUpdateCb) subNodeCallbacksRef.current.set(nodeId, subNodeUpdateCb);
    setPickerConfig({ nodeId, pickType });
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (PROTECTED_IDS.includes(nodeId)) {
      addLog('Помилка: Неможливо видалити системну ноду', 'error');
      return;
    }
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges, addLog, takeSnapshot]);

  const handleDeleteNodes = useCallback((toDeleteInput?: any[]) => {
    const toDelete = toDeleteInput || selectedNodesRef.current;
    const idsToDelete = toDelete.map(item => typeof item === 'string' ? item : item.id).filter(id => !PROTECTED_IDS.includes(id));
    if (idsToDelete.length > 0) takeSnapshot();
    setNodes(nds => nds.filter(n => !idsToDelete.includes(n.id)));
    setEdges(eds => eds.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
  }, [setNodes, setEdges, takeSnapshot]);

  const handleToggleMini = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, miniCollapsed: !n.data.miniCollapsed } } : n));
  }, [setNodes]);

  const handleSetCustomIcon = useCallback((nodeId: string, iconName?: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, customIcon: iconName } } : n));
    setMenu(null);
  }, [setNodes]);

  const handleUpdateGlobalVariable = useCallback((name: string, value: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'UPDATE_VARIABLE', name, value }));
  }, []);

  const handleExportData = useCallback((data: { nodes: any[], edges: any[] }) => {
    setNodes(nds => {
      const deselected = nds.map(n => ({ ...n, selected: false }));
      const newNodes = data.nodes.map(n => ({ ...n, position: { x: n.position.x + 20, y: n.position.y + 20 }, selected: true }));
      return [...deselected, ...attachCallbacksRef.current(newNodes)];
    });
    setEdges(eds => {
      const newEdges = data.edges.map(edge => ({ ...edge, data: { ...edge.data, onDelayChange: (edgeId: string, newDelay: number) => { setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, delay: newDelay } } : e))); }, onDelete: (edgeId: string) => { setEdges((eds) => eds.filter((e) => e.id !== edgeId)); } } }));
      return [...eds, ...newEdges];
    });
  }, [setNodes, setEdges]);

  const attachCallbacks = useCallback((nds: Node[]) => {
    return nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        onPickElement: handlePickElement,
        onDataChange: handleDataChange,
        onRunNode: handleRunNode,
        onRunSubNode: handleRunSubNode,
        onRunGroup: handleRunGroup,
        onDeleteNode: handleDeleteNode,
        onToggleMini: handleToggleMini,
        onSetCustomIcon: handleSetCustomIcon,
        onDeleteNodes: handleDeleteNodes,
        onExportData: handleExportData,
        getSelectedNodes: () => selectedNodesRef.current,
        getEdges: () => edgesRef.current,
        globalVariables: globalVariablesRef.current,
        onUpdateVariable: handleUpdateGlobalVariable,
      }
    }));
  }, [handlePickElement, handleDataChange, handleRunNode, handleRunSubNode, handleRunGroup, handleDeleteNode, handleToggleMini, handleSetCustomIcon, handleDeleteNodes, handleExportData, handleUpdateGlobalVariable]);

  useEffect(() => { attachCallbacksRef.current = attachCallbacks; }, [attachCallbacks]);


  useWebSocket({ WS_HOST, wsRef, setNodes, nodesRef, subNodeCallbacksRef, setGlobalVariables, addLog, setIsBotRunning, attachCallbacks, setDebugImages });

  const { saveProject, loadProject, onClear } = useProjectManager({ API_HOST, setNodes, setEdges, attachCallbacks, setGlobalVariables, nodesRef, edgesRef, globalVariablesRef, addLog });

  // Ефект для синхронізації змінної currentProject з адресою (URL) сторінки
  useEffect(() => {
    // Зчитуємо поточні параметри URL
    const params = new URLSearchParams(window.location.search);
    // Якщо параметр у URL відрізняється від поточного стану проекту
    if (params.get('project') !== currentProject) {
      // Оновлюємо або створюємо параметр
      params.set('project', currentProject);
      // Записуємо оновлений URL в історію браузера без перезавантаження
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    } // Закриваємо умову перевірки розбіжності
  }, [currentProject]); // Ефект виконується при зміні поточного проекту

  // Ефект для обробки навігації користувача кнопками "Назад" та "Вперед"
  useEffect(() => {
    // Обробник події popstate зміни історії
    const handlePopState = () => {
      // Отримуємо актуальні параметри з URL
      const params = new URLSearchParams(window.location.search);
      // Зчитуємо проект або використовуємо 'default'
      const projParam = params.get('project') || 'default';
      // Якщо проект відрізняється від нашого стейту
      if (projParam !== currentProject) {
        // Оновлюємо стейт проекту
        setCurrentProject(projParam);
        // Записуємо його у локальне сховище
        localStorage.setItem('sfl_current_project', projParam);
        // Завантажуємо дані проекту з сервера
        loadProject(projParam);
      } // Закриваємо умову перевірки відмінності проекту
    }; // Закриваємо функцію handlePopState
    // Додаємо слухач події popstate
    window.addEventListener('popstate', handlePopState);
    // Очищуємо слухач при розмонтуванні
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentProject, loadProject]); // Ефект виконується при зміні проекту або функції завантаження

  // Обгортка збереження імені проекту для передачі в модалку
  const handleManagerSave = useCallback((asNew?: boolean) => {
    // Якщо збереження як новий, або проект не заданий, або є проектом за замовчуванням
    if (asNew || !currentProject || currentProject === 'default') {
      // Запитуємо у користувача нове ім'я
      const name = window.prompt('Назва проекту:', currentProject || '');
      // Якщо користувач ввів ім'я
      if (name) {
        // Оновлюємо стейт проекту
        setCurrentProject(name);
        // Записуємо назву в локальне сховище
        localStorage.setItem('sfl_current_project', name);
        // Зберігаємо проект на сервері
        saveProject(name);
      } // Закриваємо умову введення імені
    } else {
      // Інакше зберігаємо поточний проект
      saveProject(currentProject);
    } // Закриваємо розгалуження збереження
  }, [currentProject, saveProject]); // Мемоїзуємо колбек збереження

  // Колбек для завантаження обраного проекту
  const handleManagerLoad = useCallback((name: string) => {
    // Оновлюємо назву поточного проекту
    setCurrentProject(name);
    // Зберігаємо назву в локальне сховище
    localStorage.setItem('sfl_current_project', name);
    // Завантажуємо дані проекту через менеджер
    loadProject(name);
  }, [loadProject]); // Мемоїзуємо колбек завантаження

  // Колбек для створення нового проекту
  const handleManagerNew = useCallback(() => {
    // Скидаємо ім'я проекту на 'default'
    setCurrentProject('default');
    // Записуємо дефолтне ім'я в локальне сховище
    localStorage.setItem('sfl_current_project', 'default');
    // Очищуємо поточне робоче поле
    onClear();
  }, [onClear]); // Мемоїзуємо колбек створення нового

  useAutoSave(nodes, edges, globalVariablesRef, API_HOST);

  useEffect(() => {
    const nodesNeedingVars = ['variablesMonitorNode', 'calculatorNode', 'multiLogicNode', 'variableNode', 'compareNode', 'groupNode'];
    setNodes((nds) => {
      let hasChanges = false;
      const newNds = nds.map(node => {
        if (!node.type || !nodesNeedingVars.includes(node.type)) return node;
        hasChanges = true;
        return { ...node, data: { ...node.data, globalVariables, onUpdateVariable: handleUpdateGlobalVariable } };
      });
      return hasChanges ? newNds : nds;
    });
  }, [globalVariables, handleUpdateGlobalVariable, setNodes]);

  // Підтримка додавання нод тапом (кліком) із Sidebar
  useEffect(() => {
    const handleAddNodeTap = (e: any) => {
      const { type } = e.detail;
      if (!reactFlowInstance) return;
      
      reactFlowInstance.getViewport();
      // Розміщуємо в центрі видимого полотна
      const position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });

      const cfg = NODE_CONFIG[type];
      const newNode: Node = { 
        id: getId(), 
        type, 
        position, 
        dragHandle: '.drag-handle', 
        data: { 
          label: cfg?.label ?? type, 
          selector: '', 
          ...(cfg?.defaults ?? {}) 
        } 
      };
      setNodes(nds => attachCallbacksRef.current([...nds, newNode]));
    };

    window.addEventListener('add-node-tap', handleAddNodeTap);
    return () => window.removeEventListener('add-node-tap', handleAddNodeTap);
  }, [reactFlowInstance, setNodes]);

  const stopBot = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'STOP_BOT' }));
      setIsBotRunning(false);
      addLog('Бот зупинений користувачем', 'info');
    }
  }, [addLog]);

  const onConnect = useCallback((params: Connection | Edge) => {
    const newEdge = { ...params, type: 'delayEdge', data: { delay: 0, onDelayChange: (edgeId: string, newDelay: number) => { setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, delay: newDelay } } : e))); }, onDelete: (edgeId: string) => { setEdges((eds) => eds.filter((e) => e.id !== edgeId)); } } };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const cfg = NODE_CONFIG[type];
    const newNode: Node = { 
      id: getId(), 
      type, 
      position, 
      dragHandle: '.drag-handle', 
      data: { 
        label: cfg?.label ?? type, 
        selector: '', 
        ...(cfg?.defaults ?? {}) 
      } 
    };
    takeSnapshot();
    setNodes(nds => attachCallbacksRef.current([...nds, newNode]));
  }, [reactFlowInstance, setNodes, takeSnapshot]);

  const { onCopy, onPaste, onDeleteSelected } = useCanvasActions({ nodesRef, edgesRef, setNodes, setEdges, onCopyRaw, getPasteData, attachCallbacks: (nds) => attachCallbacksRef.current(nds), protectedIds: PROTECTED_IDS });

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const activeEl = document.activeElement;
    if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) e.preventDefault();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      takeSnapshot();
      onDeleteSelected();
    }
  }, [onDeleteSelected, takeSnapshot]);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, type: 'pane', hasSelection: selectedNodesRef.current.length > 0 });
  }, []);

  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    event.preventDefault();
    if (!node.selected) setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
    // Примусово вважаємо що є виділення, бо ми щойно клікнули по ноді (і виділили її)
    setMenu({ x: event.clientX, y: event.clientY, type: 'node', nodeId: node.id, hasSelection: true });
  }, [setNodes]);

  const onSelectionContextMenu = useCallback((event: any) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, type: 'selection', hasSelection: true });
  }, []);

  const onPaneClick = useCallback(() => setMenu(null), []);

  const runBot = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
      const projName = localStorage.getItem('sfl_current_project') || 'default';
      const savedBrowser = localStorage.getItem(`sfl_browser_${projName}`);
      const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
      
      // Ігноруємо застарілі параметри з налаштувань браузера, щоб завжди працювали глобальні
      delete browserSettings.photoDebug;
      delete browserSettings.snapToGrid;

      const settings = { ...globalSettings, ...browserSettings };

      ws.send(JSON.stringify({ 
        type: 'RUN_BOT', 
        // Якщо ноди ще не завантажено — надсилаємо порожній масив, бекенд підтягне з файлу
        nodes: nodesRef.current || [], 
        edges: edgesRef.current || [], 
        globalVariables: globalVariablesRef.current,
        settings
      }));
      setIsBotRunning(true);
      addLog('Запуск сценарію...', 'success');
    }
  }, [addLog]);


  const onSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    setSelectedNodes(params.nodes);
    const selNodeIds = new Set(params.nodes.map(n => n.id));
    setEdges(eds => eds.map(edge => {
      const isConnected = selNodeIds.has(edge.source) || selNodeIds.has(edge.target);
      return { ...edge, animated: isConnected, style: { ...edge.style, stroke: isConnected ? '#3b82f6' : '#334155', strokeWidth: isConnected ? 3 : 1.5, opacity: isConnected ? 1 : 0.4 } };
    }));
  }, [setEdges]);

  return (
    <div className={`h-screen w-screen bg-[#020617] text-slate-200 selection:bg-indigo-500/30 font-inter ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${!isScreenshotSidebarCollapsed ? 'screenshot-sidebar-open' : ''}`}>
      <style>{`.sidebar-collapsed .react-flow__pane { margin-left: 0 !important; } .screenshot-sidebar-open .react-flow__pane { margin-right: 320px !important; }`}</style>
      <div className="flex h-full w-full overflow-hidden relative">
        {/* Sidebar — ховається коли менеджер відкритий */}
        {!isManagerOpen && (
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            setIsCollapsed={(val) => { setIsSidebarCollapsed(val); localStorage.setItem('sfl_sidebar_collapsed', String(val)); }}
            onSettingsToggle={() => setShowSettings(true)}
            onOpenManager={() => setIsManagerOpen(true)}
            onScheduleToggle={() => setIsScheduleManagerOpen(true)}
          />
        )}
        <ReactFlowProvider>
          <div className="absolute inset-0 overflow-hidden" ref={reactFlowWrapper}>
            
            {/* ── Кнопка Старт/Стоп та Інструменти (Верхній правий кут) ── */}
            <div className="fixed top-6 right-6 z-[var(--z-canvas-button)] flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {/* Згорнуті кнопки локального проекту */}
                {isToolbarExpanded && (
                  <div className="flex items-center gap-2 mr-1 animate-in slide-in-from-right-4 fade-in duration-300">
                    <button
                      onClick={() => setIsMapOpen(true)}
                      disabled={!currentProject}
                      className={`p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border ${currentProject ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] border-[var(--accent-emerald)]/40 hover:bg-[var(--accent-emerald)]/30 shadow-[var(--accent-emerald)]/20' : 'bg-gray-500/10 text-gray-600 border-gray-500/20 cursor-not-allowed'}`}
                      title={currentProject ? 'Карта Острова' : 'Завантажте проект'}
                    >
                      <LucideIcons.Map size={18} />
                    </button>
                    <button
                      onClick={() => setIsInventoryOpen(true)}
                      disabled={!currentProject}
                      className={`p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border ${currentProject ? 'bg-[var(--accent-indigo)]/20 text-[var(--accent-indigo)] border-[var(--accent-indigo)]/40 hover:bg-[var(--accent-indigo)]/30 shadow-[var(--accent-indigo)]/20' : 'bg-gray-500/10 text-gray-600 border-gray-500/20 cursor-not-allowed'}`}
                      title={currentProject ? 'Інвентар' : 'Завантажте проект'}
                    >
                      <LucideIcons.Package size={18} />
                    </button>
                    <button
                      onClick={() => setIsScreenshotSidebarCollapsed(!isScreenshotSidebarCollapsed)}
                      disabled={!currentProject}
                      className={`p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border ${currentProject ? 'bg-[var(--accent-pink)]/20 text-[var(--accent-pink)] border-[var(--accent-pink)]/40 hover:bg-[var(--accent-pink)]/30 shadow-[var(--accent-pink)]/20' : 'bg-gray-500/10 text-gray-600 border-gray-500/20 cursor-not-allowed'}`}
                      title={currentProject ? 'Скріншоти' : 'Завантажте проект'}
                    >
                      <LucideIcons.Camera size={18} />
                    </button>
                    <button
                      onClick={() => setIsDeliveriesOpen(true)}
                      disabled={!currentProject}
                      className={`p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border ${currentProject ? 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)] border-[var(--accent-teal)]/40 hover:bg-[var(--accent-teal)]/30 shadow-[var(--accent-teal)]/20' : 'bg-gray-500/10 text-gray-600 border-gray-500/20 cursor-not-allowed'}`}
                      title={currentProject ? 'Доставки' : 'Завантажте проект'}
                    >
                      <LucideIcons.Truck size={18} />
                      </button>
                      <button
                        onClick={() => setCurrentView('scheduler')}
                        className="p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border bg-[var(--accent-orange)]/20 text-[var(--accent-orange)] border-[var(--accent-orange)]/40 hover:bg-[var(--accent-orange)]/30 shadow-[var(--accent-orange)]/20"
                        title="Масовий Планувальник"
                      >
                        <LucideIcons.CalendarClock size={18} />
                      </button>
                      <button
                        onClick={() => setCurrentView('inventory')}
                        className="p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30 shadow-blue-500/20"
                        title="Загальний Інвентар (Overview)"
                      >
                        <LucideIcons.LayoutGrid size={18} />
                      </button>
                  </div>
                )}
                
                {/* Кнопка розгортання */}
                <button 
                  onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
                  className="p-2 text-gray-400 hover:text-white transition-colors bg-[#0f172a]/50 rounded-xl border border-white/5 backdrop-blur-md shadow-xl"
                  title={isToolbarExpanded ? 'Згорнути інструменти' : 'Розгорнути інструменти'}
                >
                  {isToolbarExpanded ? <LucideIcons.ChevronRight size={16} /> : <LucideIcons.ChevronLeft size={16} />}
                </button>

                {/* Кнопка Старт/Стоп бота (тільки іконка) */}
                <button
                  onClick={isBotRunning ? stopBot : runBot}
                  className={`p-2.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border ${
                    isBotRunning 
                      ? 'bg-[var(--button-danger-bg)]/20 text-[var(--button-danger-bg)] border-[var(--button-danger-bg)]/40 hover:bg-[var(--button-danger-bg)]/30 shadow-[var(--button-danger-bg)]/20' 
                      : 'bg-[var(--button-success-bg)]/20 text-[var(--button-success-bg)] border-[var(--button-success-bg)]/40 hover:bg-[var(--button-success-bg)]/30 shadow-[var(--button-success-bg)]/20'
                  }`}
                  title={isBotRunning ? 'Зупинити бота' : 'Запустити бота'}
                >
                  {isBotRunning ? (
                    <LucideIcons.Square size={18} fill="currentColor" />
                  ) : (
                    <LucideIcons.Play size={18} fill="currentColor" />
                  )}
                </button>
              </div>

              {/* Нижні кнопки (глобальні) */}
              {isToolbarExpanded && (
                <div className="flex items-center gap-2 mr-[82px] animate-in slide-in-from-right-4 fade-in duration-300 delay-75">
                  <button
                    onClick={() => setIsAllInventoriesOpen(true)}
                    className="p-2 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border-[var(--accent-indigo)]/30 hover:bg-[var(--accent-indigo)]/20"
                    title="Всі Інвентарі"
                  >
                    <LucideIcons.Boxes size={16} />
                  </button>
                  <button
                    onClick={() => setIsAllScreenshotsOpen(true)}
                    className="p-2 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border bg-[var(--accent-pink)]/10 text-[var(--accent-pink)] border-[var(--accent-pink)]/30 hover:bg-[var(--accent-pink)]/20"
                    title="Всі Скріншоти"
                  >
                    <LucideIcons.Images size={16} />
                  </button>
                  <button
                    onClick={() => setIsAllDeliveriesOpen(true)}
                    className="p-2 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/30 hover:bg-[var(--accent-teal)]/20"
                    title="Всі Доставки"
                  >
                    <LucideIcons.Globe size={16} />
                  </button>
                </div>
              )}
            </div>

            <GlobalSettings forceOpen={showSettings} onOpenChange={setShowSettings} />
            {pickerConfig && (
              <StreamPicker ws={wsRef.current} wsUrl={pickerConfig.wsUrl} nodeId={pickerConfig.nodeId} pickType={pickerConfig.pickType} onClose={() => setPickerConfig(null)} />
            )}
            <button
              onClick={() => setPickerConfig({ nodeId: 'remote_browser', pickType: 'default' })}
              className={`fixed right-6 z-[var(--z-panel)] w-14 h-14 bg-[var(--accent-indigo)] text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-[var(--accent-indigo)]/80 hover:scale-110 active:scale-95 transition-all duration-300 group border-2 border-white/20 backdrop-blur-sm ${isConsoleOpen && !isManagerOpen ? 'bottom-[370px]' : 'bottom-20'}`}
              title="Відкрити віддалене керування"
            >
              <Globe size={26} className="group-hover:rotate-12 transition-transform" />
              {isBotRunning && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--button-success-bg)] rounded-full border-2 border-white animate-pulse" />
              )}
              <span className="absolute right-full mr-3 px-2 py-1 bg-black/80 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
                Браузер
              </span>
            </button>
            {/* ConsolePane — ховається коли менеджер відкритий */}
            {!isManagerOpen && (
              <ConsolePane 
                isOpen={isConsoleOpen}
                setIsOpen={setIsConsoleOpen}
                isSidebarCollapsed={isSidebarCollapsed}
                logs={logs}
                setLogs={setLogs}
                debugImages={debugImages}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentProject={currentProject}
              />
            )}

            {/* Менеджер проектів — повноекранна модалка */}
            <ProjectManagerModal
              isOpen={isManagerOpen}
              onClose={() => setIsManagerOpen(false)}
              currentProject={currentProject}
              onNew={handleManagerNew}
              onSave={handleManagerSave}
              onLoad={handleManagerLoad}
              onSettingsToggle={() => { setShowSettings(true); setIsManagerOpen(false); }}
              onGlobalStatsToggle={() => { setShowGlobalStats(true); setIsManagerOpen(false); }}
              onOpenBrowser={(projName) => {
                const wsUrl = projName && projName !== currentProject ? getWsHost(projName) : undefined;
                setPickerConfig({ nodeId: 'remote_browser', pickType: 'default', wsUrl });
                setIsManagerOpen(false);
              }}
            />

            <GlobalStatisticsModal
              isOpen={showGlobalStats}
              onClose={() => setShowGlobalStats(false)}
            />

            <ScheduleManager
              isOpen={isScheduleManagerOpen}
              onClose={() => setIsScheduleManagerOpen(false)}
            />

            {/* Модалка інвентаря */}
            <InventoryModal
              isOpen={isInventoryOpen}
              onClose={() => setIsInventoryOpen(false)}
              projectName={currentProject || ''}
            />

            {/* Модалка Карти Острова */}
            <IslandMapModal
              isOpen={isMapOpen}
              onClose={() => setIsMapOpen(false)}
              projectName={currentProject || ''}
            />

            {/* Панель скріншотів */}
            <ScreenshotSidebar
              projectName={currentProject}
              isCollapsed={isScreenshotSidebarCollapsed}
              onToggle={() => setIsScreenshotSidebarCollapsed(!isScreenshotSidebarCollapsed)}
            />

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onlyRenderVisibleElements={true}
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
              }}
              onNodesDelete={onNodesDelete}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              colorMode={theme}
              zoomOnScroll={true}
              panOnScroll={false}
              panOnDrag={window.innerWidth < 768 ? true : [1, 2]} 
              selectionOnDrag={window.innerWidth >= 768}
              selectionMode={SelectionMode.Partial}
              selectionKeyCode={null}
              onKeyDown={onKeyDown}
              fitView
              onPaneContextMenu={onPaneContextMenu}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onPaneContextMenu}
              onSelectionContextMenu={onSelectionContextMenu}
              onPaneClick={onPaneClick}
              minZoom={0.05}
              maxZoom={3}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} style={{ backgroundColor: 'hsl(var(--global-map-color))' }} />
              <Controls />
              
              {/* Контекстне меню */}
              <NodeContextMenu 
                menu={menu}
                onCopy={onCopy}
                onPaste={(pos) => {
                  // Перетворюємо екранні координати контекстного меню у внутрішні координати полотна React Flow
                  const flowPos = reactFlowInstance ? reactFlowInstance.screenToFlowPosition({ x: pos.x, y: pos.y }) : pos;
                  // Викликаємо функцію вставки з правильними спроектованими координатами
                  onPaste(flowPos);
                }}
                onDeleteSelected={onDeleteSelected}
                onSetCustomIcon={handleSetCustomIcon}
                onClickOutside={() => setMenu(null)}
              />
            </ReactFlow>
            <PortTooltipManager nodes={nodes} />
          </div>
        </ReactFlowProvider>
      </div>
      <DeliveriesModal isOpen={isDeliveriesOpen} onClose={() => setIsDeliveriesOpen(false)} projectName={currentProject || ''} />
      <AllDeliveriesModal isOpen={isAllDeliveriesOpen} onClose={() => setIsAllDeliveriesOpen(false)} />
      <AllScreenshotsModal isOpen={isAllScreenshotsOpen} onClose={() => setIsAllScreenshotsOpen(false)} />
      <AllInventoriesModal isOpen={isAllInventoriesOpen} onClose={() => setIsAllInventoriesOpen(false)} />
    </div>
  );
};

export default NodeEditor;
