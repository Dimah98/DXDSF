import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Handle, Position,
  ReactFlow, ReactFlowProvider, addEdge,
  useNodesState, useEdgesState,
  Controls, Background, BackgroundVariant,
  SelectionMode,
  type Node as RFNode, type Edge as RFEdge
} from '@xyflow/react';
import { Package, ChevronRight, X, Download, Upload, Play, Settings } from 'lucide-react';
import { getHandleStyle } from './BaseNode';
import { SUB_NODE_TYPES } from './subNodeTypes';
import { NODE_CONFIG, SIDEBAR_NODE_TYPES } from '../../nodeConfig';
import DelayEdge from '../DelayEdge';
import { NodeContextMenu } from '../ui/NodeContextMenu';
import { useCanvasActions } from '../../hooks/useCanvasActions';
import { useClipboard } from '../../hooks/useClipboard';
import { attachEdgeCallbacks } from '../../utils/flowUtils';
import { useExecutionStore } from '../../store/useExecutionStore';
import { GroupSettingsModal } from './GroupSettingsModal';
import '@xyflow/react/dist/style.css';

// Лічильник ID для нових суб-нод
let subIdCounter = Date.now();
const getSubId = () => `sub_${subIdCounter++}`;

// Початкові ноди для нового контейнера
const createDefaultSubNodes = (): RFNode[] => [
  {
    id: 'sub_entry',
    type: 'subEntryNode',
    position: { x: 80, y: 220 },
    data: {},
    draggable: true,
    deletable: false,
  },
  {
    id: 'sub_exit',
    type: 'subExitNode',
    position: { x: 640, y: 220 },
    data: {},
    draggable: true,
    deletable: false,
  },
];

// Захищені ноди (не видаляються)
const PROTECTED_IDS = ['sub_entry', 'sub_exit'];

const edgeTypes = { delayEdge: DelayEdge };

// ── Внутрішній Canvas (відкритий стан) ────────────────────────────────────────
const SubCanvas = ({
  initialNodes,
  initialEdges,
  onClose,
  onSave,
  groupData,
  getSelectedNodes, // Getter-функція → завжди актуальний список зовнішніх нод
  getEdges,         // Getter-функція → всі зовнішні лінії
  onImportDone,
  onExportData,    // Колбек: експортувати внутрішні ноди на головну карту
}: {
  initialNodes: RFNode[];
  initialEdges: RFEdge[];
  onClose: () => void;
  onSave: (nodes: RFNode[], edges: RFEdge[]) => void;
  groupData: any;
  getSelectedNodes: () => RFNode[];
  getEdges: () => RFEdge[];
  onImportDone: (importedIds: string[]) => void;
  onExportData: (data: { nodes: RFNode[], edges: RFEdge[] }) => void;
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null); // Посилання на модальне вікно
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Refs для уникнення stale closure в колбеках
  const subNodesRef = useRef<RFNode[]>(nodes);
  const subEdgesRef = useRef<RFEdge[]>(edges);
  useEffect(() => { subNodesRef.current = nodes; }, [nodes]);
  useEffect(() => { subEdgesRef.current = edges; }, [edges]);

  // Стан виділених нод ВСЕРЕДИНІ контейнера (для експорту)
  const [selectedInnerNodes, setSelectedInnerNodes] = useState<RFNode[]>([]);

  // Буфер обміну та дії на полотні
  const { onCopy: onCopyRaw, getPasteData } = useClipboard();
  
  // Getter-функція для attachCallbacks (аналог NodeEditor)
  const attachCallbacks = useCallback((nds: RFNode[]) => {
    return nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        onDataChange: (nId: string, newData: any) => {
          setNodes(nds => nds.map(n => n.id === nId ? { ...n, data: { ...n.data, ...newData } } : n));
        },
        onDeleteNode: (nId: string) => {
          if (PROTECTED_IDS.includes(nId)) return;
          setNodes(nds => nds.filter(n => n.id !== nId));
        },
        onToggleMini: (nId: string) => {
          setNodes(nds => nds.map(n => n.id === nId ? { ...n, data: { ...n.data, miniCollapsed: !n.data.miniCollapsed } } : n));
        },
        onPickElement: (nId: string, pickType: string) => {
          groupData.onPickElement?.(nId, pickType, (pickerData: any) => {
            setNodes(nds => nds.map(n => {
              if (n.id !== nId) return n;
              if (pickerData.pickType === 'parent') return { ...n, data: { ...n.data, parentSelector: pickerData.selector } };
              if (pickerData.pickType === 'child')  return { ...n, data: { ...n.data, childSelector: pickerData.selector } };
              if (pickerData.pickType?.startsWith('item_')) {
                const idx = parseInt(pickerData.pickType.split('_')[1]);
                const newItems = [...(n.data.scanItems as any[] || [])];
                if (newItems[idx]) newItems[idx].selector = pickerData.selector || pickerData.info?.selector;
                return { ...n, data: { ...n.data, scanItems: newItems } };
              }
              return { ...n, data: { ...n.data, selector: pickerData.selector || pickerData.info?.selector } };
            }));
          });
        },
        onRunNode: (nId: string) => {
          groupData.onRunSubNode?.(nId, subNodesRef.current, subEdgesRef.current);
        },
        onUpdateVariable: groupData.onUpdateVariable,
        globalVariables: groupData.globalVariables || {},
      }
    }));
  }, [groupData.onPickElement, groupData.onRunSubNode, groupData.onUpdateVariable, groupData.globalVariables, setNodes]);

  const { onCopy, onPaste, onDeleteSelected } = useCanvasActions({
    nodesRef: subNodesRef as any,
    edgesRef: subEdgesRef as any,
    setNodes: setNodes as any,
    setEdges: setEdges as any,
    onCopyRaw,
    getPasteData: getPasteData as any,
    attachCallbacks: attachCallbacks as any,
    protectedIds: PROTECTED_IDS,
    filterPasteNodes: (node) => !['startNode', 'groupNode', 'subEntryNode', 'subExitNode'].includes(node.type || '')
  });

  // Підключаємо колбеки до під-нод та оновлюємо змінні всередині контейнера
  useEffect(() => {
    setNodes(nds => attachCallbacks(nds));
    setEdges(eds => attachEdgeCallbacks(eds, setEdges as any));
  }, [groupData.globalVariables, groupData.onUpdateVariable, attachCallbacks, setNodes, setEdges]);

  // Контекстне меню ПКМ
  const [menu, setMenu] = useState<{ x: number, y: number, type: 'pane' | 'node', nodeId?: string } | null>(null);

  // Кількість виділених зовнішніх нод (читаємо через getter в момент рендеру)
  const selectedMain = getSelectedNodes().filter(
    (n: RFNode) => !['startNode', 'groupNode', 'subEntryNode', 'subExitNode'].includes(n.type || '')
  );

  // Слухаємо оновлення даних нод від головного редактора (WebSocket)
  const activeExecutingNodeId = useExecutionStore((s) => s.activeExecutingNodeId);
  const nodeDataUpdates = useExecutionStore((s) => s.nodeDataUpdates);
  const botFinishedSignal = useExecutionStore((s) => s.botFinishedSignal);

  useEffect(() => {
    if (activeExecutingNodeId !== undefined) {
      setNodes(nds => nds.map(n => ({
        ...n,
        style: n.id === activeExecutingNodeId
          ? { ...n.style, boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)', outline: '2px solid #3b82f6' }
          : { ...n.style, boxShadow: 'none', outline: 'none' }
      })));
    }
  }, [activeExecutingNodeId, setNodes]);

  useEffect(() => {
    if (nodeDataUpdates) {
      const { nodeId, data } = nodeDataUpdates;
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    }
  }, [nodeDataUpdates, setNodes]);

  useEffect(() => {
    if (botFinishedSignal > 0) {
      setNodes(nds => nds.map(n => ({ ...n, style: { ...n.style, boxShadow: 'none', outline: 'none' } })));
    }
  }, [botFinishedSignal, setNodes]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const { nodeId, data } = e.detail;
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    };
    const handleExec = (e: any) => {
      const { nodeId } = e.detail;
      setNodes(nds => nds.map(n => ({
        ...n,
        style: n.id === nodeId 
          ? { ...n.style, boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)', outline: '2px solid #3b82f6' }
          : { ...n.style, boxShadow: 'none', outline: 'none' }
      })));
    };
    const handleFinished = () => {
      setNodes(nds => nds.map(n => ({ ...n, style: { ...n.style, boxShadow: 'none', outline: 'none' } })));
    };
    window.addEventListener('sfl-node-data-update', handleUpdate);
    window.addEventListener('sfl-node-executing', handleExec);
    window.addEventListener('sfl-bot-finished', handleFinished);
    return () => {
      window.removeEventListener('sfl-node-data-update', handleUpdate);
      window.removeEventListener('sfl-node-executing', handleExec);
      window.removeEventListener('sfl-bot-finished', handleFinished);
    };
  }, [setNodes]);

  const onSelectionChange = useCallback((params: { nodes: RFNode[]; edges: RFEdge[] }) => {
    const { nodes: selNodes } = params;
    // Зберігаємо виділені ноди для копіювання/експорту
    setSelectedInnerNodes(selNodes);

    // Підсвічуємо лінії
    const selectedNodeIds = new Set(selNodes.map((n) => n.id));
    setEdges((eds) =>
      eds.map((edge) => {
        const isConnected = selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);
        return {
          ...edge,
          animated: isConnected,
          style: {
            ...edge.style,
            stroke: isConnected ? '#3b82f6' : '#334155',
            strokeWidth: isConnected ? 3 : 1.5,
            opacity: isConnected ? 1 : 0.4,
          },
        };
      })
    );
  }, [setEdges, setSelectedInnerNodes]);

  // Автозбереження при будь-якій зміні nodes або edges
  useEffect(() => {
    const t = setTimeout(() => {
      onSave(nodes, edges);
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, onSave]);

  // Копіювання — зберігаємо в localStorage щоб можна було вставити з іншого canvas
  // Закриття меню при кліку будь-де
  const onPaneClick = useCallback(() => {
    setMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((event: any, node: RFNode) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    // Виділяємо ноду при кліку ПКМ, якщо вона ще не виділена
    if (!node.selected) {
      setNodes(nds => nds.map(n => ({
        ...n,
        selected: n.id === node.id
      })));
      setSelectedInnerNodes([node]);
    }

    setMenu({ 
      x: event.clientX, 
      y: event.clientY, 
      type: 'node', 
      nodeId: node.id,
      nodeType: node.type,
      hasSelection: true 
    });
  }, [setNodes]);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    event.stopPropagation();
    const hasSelection = subNodesRef.current.some(n => n.selected && !PROTECTED_IDS.includes(n.id));
    setMenu({ 
      x: event.clientX, 
      y: event.clientY, 
      type: 'pane',
      hasSelection 
    });
  }, []);

  const onSelectionContextMenu = useCallback((event: any) => {
    event.preventDefault();
    event.stopPropagation();
    const hasSelection = subNodesRef.current.some(n => n.selected && !PROTECTED_IDS.includes(n.id));
    setMenu({ 
      x: event.clientX, 
      y: event.clientY, 
      type: 'pane',
      hasSelection 
    });
  }, []);

  // Drag-and-drop нових нод із міні-сайдбару
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const cfg = NODE_CONFIG[type];
    const newNode: RFNode = {
      id: getSubId(),
      type,
      position,
      dragHandle: '.drag-handle',
      data: {
        label: cfg?.label ?? type,
        selector: '',
        ...(cfg?.defaults ?? {}),
      },
    };
    setNodes(nds => attachCallbacks([...nds, newNode]));
  }, [reactFlowInstance, attachCallbacks, setNodes]);

  // Клавіатурні скорочення (Ctrl+C / Ctrl+V / Delete) для sub-canvas з підтримкою української розкладки
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Якщо фокус у полі вводу — дозволяємо стандартну поведінку
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable) return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const keyLower = e.key?.toLowerCase();
      const isC = e.code === 'KeyC' || keyLower === 'c' || keyLower === 'с'; // en 'c' or ukr 'с'
      const isV = e.code === 'KeyV' || keyLower === 'v' || keyLower === 'м'; // en 'v' or ukr 'м'

      if (isCtrlOrMeta && isC) { 
        e.preventDefault(); 
        e.stopPropagation();
        onCopy(); 
      }
      if (isCtrlOrMeta && isV) { 
        e.preventDefault(); 
        e.stopPropagation();
        onPaste(); 
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { 
        e.preventDefault();
        e.stopPropagation();
        onDeleteSelected(); 
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onCopy, onPaste, onDeleteSelected]);

  // Захист від видалення subEntry/subExit
  const onNodesDelete = useCallback((deleted: RFNode[]) => {
    const toDelete = deleted.filter(n => !PROTECTED_IDS.includes(n.id));
    setNodes(nds => nds.filter(n => !toDelete.find((d: RFNode) => d.id === n.id)));
  }, [setNodes]);

  const onConnect = useCallback(
    (connection: any) => {
      const newEdge = {
        ...connection,
        type: 'delayEdge',
        data: { delay: 0 }
      };
      setEdges(eds => attachEdgeCallbacks(addEdge(newEdge, eds), setEdges as any));
    },
    [setEdges]
  );

  // Імпорт виділених нод з головного canvas
  const importSelected = useCallback(() => {
    const importable = getSelectedNodes().filter(
      (n: RFNode) => !['startNode', 'groupNode', 'subEntryNode', 'subExitNode'].includes(n.type || '')
    );
    if (importable.length === 0) return;

    const importableIds = importable.map((n: RFNode) => n.id);
    const mainEdges = getEdges?.() || [];
    const importableEdges = mainEdges.filter(
      (e: RFEdge) => importableIds.includes(e.source) && importableIds.includes(e.target)
    );

    // Зсуваємо позиції нод
    const minX = Math.min(...importable.map((n: RFNode) => n.position.x));
    const minY = Math.min(...importable.map((n: RFNode) => n.position.y));

    const newNodes = importable.map((n: RFNode) => ({
      ...n,
      position: {
        x: n.position.x - minX + 180,
        y: n.position.y - minY + 120,
      },
      selected: false,
    }));

    setNodes(nds => [...nds, ...attachCallbacks(newNodes as RFNode[])]);
    setEdges(eds => [...eds, ...attachEdgeCallbacks(importableEdges as any, setEdges as any)]);
    // Видаляємо перенесені ноди з головного canvas
    onImportDone(importableIds);
  }, [getSelectedNodes, getEdges, setNodes, setEdges, attachCallbacks, onImportDone]);

  // Експорт нод з контейнера на головне полотно
  const exportSelected = useCallback(() => {
    const exportable = selectedInnerNodes.filter(n => !PROTECTED_IDS.includes(n.id));
    if (exportable.length === 0) return;

    const exportIds = exportable.map(n => n.id);
    const exportEdges = edges.filter(e => exportIds.includes(e.source) && exportIds.includes(e.target));
    
    // Видаляємо ноди та їхні лінії з внутрішнього полотна
    setNodes(nds => nds.filter(n => !exportIds.includes(n.id)));
    setEdges(eds => eds.filter(e => !exportIds.includes(e.source) && !exportIds.includes(e.target)));
    
    // Передаємо на головне полотно
    onExportData({ nodes: exportable, edges: exportEdges });
    setSelectedInnerNodes([]);
  }, [selectedInnerNodes, edges, setNodes, setEdges, onExportData]);

  // Рендеримо через createPortal щоб уникнути конфліктів з головним ReactFlow
  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-special)] flex items-center justify-center pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={e => { e.stopPropagation(); setMenu(null); }}
      onWheel={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      onDragOver={e => e.stopPropagation()}
      onDrop={e => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        className="relative flex flex-col rounded-2xl shadow-2xl border border-blue-500/25 overflow-hidden"
        style={{
          width: '96vw',
          maxWidth: '1600px',
          height: '92vh',
          maxHeight: '1000px',
          background: '#0d1117',
        }}
      >
        {/* ── Заголовок ── */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-blue-900/40 shrink-0"
          style={{ background: 'linear-gradient(90deg, #0f1f3d, #0d1117)' }}
        >
          <div className="flex items-center gap-2">
            <Package size={14} className="text-blue-400" />
            <span className="text-[12px] font-bold text-white">📦 {groupData.label || 'Контейнер'}</span>
          </div>
          <div className="flex items-center gap-2">

            {/* Кнопка: Пуск — запустити тільки ноди всередині контейнера */}
            <button
              onClick={() => groupData.onRunGroup?.(groupData.id || '', subNodesRef.current, subEdgesRef.current)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-colors border bg-green-500/20 hover:bg-green-500/40 text-green-300 border-green-500/40 cursor-pointer"
              title="Запустити тільки ноди всередині контейнера"
            >
              <Play size={10} />
              Пуск
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>

            {/* Кнопка: Дістати ноди (експорт) */}
            <button
              onClick={exportSelected}
              disabled={selectedInnerNodes.filter(n => !PROTECTED_IDS.includes(n.id)).length === 0}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-colors border ${
                selectedInnerNodes.filter(n => !PROTECTED_IDS.includes(n.id)).length > 0
                  ? 'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/30 cursor-pointer'
                  : 'bg-white/5 text-white/20 border-white/10 cursor-not-allowed'
              }`}
              title="Перемістити вибрані внутрішні ноди назад на головне полотно"
            >
              <Upload size={10} />
              Дістати ноди
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>

            {/* Кнопка імпорту */}
            <button
              onClick={importSelected}
              disabled={selectedMain.length === 0}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-colors border ${
                selectedMain.length > 0
                  ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border-amber-500/30 cursor-pointer'
                  : 'bg-white/5 text-white/20 border-white/10 cursor-not-allowed'
              }`}
              title={selectedMain.length > 0
                ? `Перемістити ${selectedMain.length} виділених нод сюди`
                : 'Спочатку виділіть ноди на головному canvas'}
            >
              <Download size={10} />
              {selectedMain.length > 0
                ? `Перемістити виділені (${selectedMain.length})`
                : 'Виділіть ноди на canvas'}
            </button>

            <div className="text-[10px] text-green-400/80 italic ml-2 px-2 flex items-center">
              ✓ Зберігається автоматично
            </div>

            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 text-white/60 hover:text-white rounded transition-colors ml-1 border border-white/10 bg-white/5"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Тіло: міні-сайдбар + canvas ── */}
        <div className="flex flex-1 min-h-0 relative">

          {/* Міні-сайдбар з нодами для drag-and-drop */}
          <div className="w-32 shrink-0 border-r border-blue-900/40 bg-[#080e1a] flex flex-col overflow-y-auto p-1.5 gap-1">
            <div className="text-[8px] font-black uppercase text-white/30 px-1 py-1 tracking-widest">Ноди</div>
            {SIDEBAR_NODE_TYPES.filter(t => !['startNode','groupNode','subEntryNode','subExitNode'].includes(t)).map(type => {
              const cfg = NODE_CONFIG[type];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div
                  key={type}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 cursor-grab transition-colors text-white"
                  draggable
                  onDragStart={e => {
                    e.stopPropagation(); // Не баблімо драг до головного canvas
                    e.dataTransfer.setData('application/reactflow', type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  title={cfg.desc}
                >
                  <span className="shrink-0 p-0.5 rounded" style={{ color: cfg.defaultColor }}>
                    <Icon size={11} />
                  </span>
                  <span className="text-[9px] font-bold truncate">{cfg.label}</span>
                </div>
              );
            })}
          </div>

          <ReactFlowProvider>
            <div className="flex-1 relative" ref={reactFlowWrapper}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onlyRenderVisibleElements={true}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onSelectionChange={onSelectionChange}
                onNodesDelete={onNodesDelete}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onPaneClick={onPaneClick}
                onNodeClick={onPaneClick}
                onEdgeClick={onPaneClick}
                onNodeContextMenu={onNodeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                onSelectionContextMenu={onSelectionContextMenu}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={SUB_NODE_TYPES}
                edgeTypes={edgeTypes}
                snapToGrid={true}
                snapGrid={[20, 20]}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                deleteKeyCode="Delete"
                proOptions={{ hideAttribution: true }}
                zoomOnScroll={true}
                panOnScroll={false}
                panOnDrag={[1, 2]}
                selectionOnDrag={true}
                selectionMode={SelectionMode.Partial}
                colorMode="dark"
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(59,130,246,0.05)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </ReactFlowProvider>

          {/* Контекстне меню */}
          <NodeContextMenu 
            menu={menu}
            onCopy={onCopy}
            onPaste={(pos) => {
              // Перетворюємо екранні координати контекстного меню у внутрішні координати під-полотна React Flow
              const flowPos = reactFlowInstance ? reactFlowInstance.screenToFlowPosition({ x: pos.x, y: pos.y }) : pos;
              // Викликаємо функцію вставки для підпрограми з правильними спроектованими координатами
              onPaste(flowPos);
            }}
            onDeleteSelected={onDeleteSelected}
            onSetCustomIcon={(nodeId, iconName) => {
              setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, customIcon: iconName } } : n));
              setMenu(null);
            }}
            onClickOutside={() => setMenu(null)}
            protectedIds={PROTECTED_IDS}
          />

        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Зовнішня нода GroupNode ────────────────────────────────────────────────────
const GroupNode = memo(({ id, data }: any) => {
  const [isOpen, setIsOpen] = useState(false);

  const subNodes: any[] = data.subNodes?.length > 0 ? data.subNodes : createDefaultSubNodes();
  const subEdges: any[] = data.subEdges || [];
  
  const activeLabel = data.activeNodeLabel || null;
  const activeNodeType = data.activeNodeType || null;
  // Іконка для вікна статусу, якщо виконується певна нода
  const ActiveIcon = activeNodeType ? NODE_CONFIG[activeNodeType]?.icon : null;

  // Кастомний колір контейнера
  const nodeColor = data.color || '#1d4ed8';

  const handleSave = useCallback((nodes: any[], edges: any[]) => {
    data.onDataChange?.(id, { subNodes: nodes, subEdges: edges });
  }, [id, data]);

  const handleImportDone = useCallback((importedIds: string[]) => {
    data.onDeleteNodes?.(importedIds);
  }, [data]);

  const handleExportData = useCallback((exportData: { nodes: any[], edges: any[] }) => {
    data.onExportData?.(exportData);
  }, [data]);

  // Getter — читаємо поточний список виділених нод і ребер через функцію
  const getSelectedNodes = useCallback(() => {
    return data.getSelectedNodes?.() ?? [];
  }, [data]);

  const getEdges = useCallback(() => {
    return data.getEdges?.() ?? [];
  }, [data]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Слухаємо подію відкриття налаштувань контейнера з ПКМ меню
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.nodeId === id) {
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener('sfl-open-group-settings', handler);
    return () => window.removeEventListener('sfl-open-group-settings', handler);
  }, [id]);

  // Відстежуємо стан виконання контейнера або його внутрішніх нод
  const isBotRunning = useExecutionStore((s) => s.isBotRunning);
  const activeExecutingNodeId = useExecutionStore((s) => s.activeExecutingNodeId);
  const [isExecutingLocally, setIsExecutingLocally] = useState(false);

  useEffect(() => {
    const handleExec = (e: any) => {
      const execNodeId = e.detail?.nodeId;
      const parentGroupId = e.detail?.parentGroupId;
      if (execNodeId === id || parentGroupId === id) {
        setIsExecutingLocally(true);
      } else if (execNodeId && !subNodes.some((n: any) => n.id === execNodeId)) {
        setIsExecutingLocally(false);
      }
    };
    const handleFinished = () => {
      setIsExecutingLocally(false);
    };
    window.addEventListener('sfl-node-executing', handleExec);
    window.addEventListener('sfl-bot-finished', handleFinished);
    return () => {
      window.removeEventListener('sfl-node-executing', handleExec);
      window.removeEventListener('sfl-bot-finished', handleFinished);
    };
  }, [id, subNodes]);

  // Контейнер світиться ТІЛЬКИ коли бот/проект реально запущений
  const isExecuting =
    Boolean(isBotRunning) &&
    (isExecutingLocally ||
      activeExecutingNodeId === id ||
      (Boolean(activeExecutingNodeId) && subNodes.some((n: any) => n.id === activeExecutingNodeId)));

  return (
    <>
      {/* ── Зовнішній вигляд (ширина зменшена на 15%: 270 -> 230) ── */}
      <div
        className={`relative rounded-xl border-2 shadow-xl overflow-visible transition-all duration-300 ${
          isExecuting ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900' : ''
        }`}
        style={{
          width: 230,
          background: `linear-gradient(145deg, #0f1e40, ${nodeColor})`,
          borderColor: isExecuting ? '#3b82f6' : nodeColor,
          boxShadow: isExecuting
            ? '0 0 25px rgba(59, 130, 246, 0.85), 0 0 10px rgba(59, 130, 246, 0.5)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          outline: isExecuting ? '2px solid #3b82f6' : 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          style={getHandleStyle('#22c55e', '50%')}
          className="!left-[-8px] !w-4 !h-4"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={getHandleStyle('#ef4444', '50%')}
          className="!right-[-8px] !w-4 !h-4"
        />

        {/* Заголовок: іконка, назва контейнера, кнопка пуск і кнопка відкрити */}
        <div
          className="drag-handle flex items-center justify-between px-2.5 py-2 cursor-grab rounded-[10px]"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onDoubleClick={() => setIsSettingsOpen(true)}
          title="Подвійний клік або ПКМ для налаштувань"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1.5">
            <Package size={14} className="text-white drop-shadow shrink-0" />
            {isExecuting && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
            <input
              type="text"
              value={data.label || 'Контейнер'}
              onChange={(e) => data.onDataChange?.(id, { label: e.target.value })}
              className="text-[11px] font-bold text-white bg-transparent outline-none w-full border-b border-transparent hover:border-white/30 focus:border-white/70 transition-colors truncate"
              placeholder="Назва контейнера"
            />
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {/* Кнопка: Пуск */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); data.onRunGroup?.(id, subNodes, subEdges); }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-300 bg-green-500/20 hover:bg-green-500/40 transition-colors border border-green-500/40 cursor-pointer"
              title="Запустити тільки ноди всередині контейнера"
            >
              <Play size={10} />
              Пуск
            </button>
            {/* Кнопка: Відкрити */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setIsOpen(true); }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-white/10 hover:bg-white/25 transition-colors border border-white/20 cursor-pointer"
            >
              <ChevronRight size={10} />
              Відкрити
            </button>
          </div>
        </div>
      </div>

      {/* ── Модальний canvas ── */}
      {isOpen && (
        <SubCanvas
          initialNodes={subNodes}
          initialEdges={subEdges}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
          groupData={data}
          getSelectedNodes={getSelectedNodes}
          getEdges={getEdges}
          onImportDone={handleImportDone}
          onExportData={handleExportData}
        />
      )}

      {/* ── Модалка налаштувань контейнера (ПКМ / дабл-клік / бейджі) ── */}
      <GroupSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        data={data}
        nodeData={data}
        onSave={(updatedData) => {
          data.onDataChange?.(id, updatedData);
        }}
      />
    </>
  );
});

export default GroupNode;
