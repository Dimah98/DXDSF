// Панель трансляції з живого браузера — повне керування мишею (drag, right-click), клавіатурою, введенням тексту і тач-зумом
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, MousePointer, MousePointer2, Loader2, ZoomIn, ZoomOut,
  Mouse, Hand, Keyboard,
  Power, Play, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Code, Maximize2, Minimize2, RotateCcw, ArrowLeft, ArrowRight,
  CornerDownLeft, Move, Crosshair, Send, Globe,
  Copy, ExternalLink, Search, RefreshCw, Check,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';


interface StreamPickerProps {
  onClose: () => void;
  ws: WebSocket | null;
  wsUrl?: string;
  nodeId: string;
  pickType: string;
}

// Режими взаємодії з браузером
export type Mode = 'direct' | 'click' | 'hover' | 'drag' | 'ctrl_click' | 'shift_click' | 'pick';

const MODES: { key: Mode; label: string; icon: React.ReactNode; color: string; hotkey: string }[] = [
  { key: 'direct',      label: 'Пряме керування', icon: <MousePointer2 size={13} />, color: 'bg-emerald-600',  hotkey: 'Q' },
  { key: 'click',       label: 'Клік',           icon: <Mouse size={13} />,          color: 'bg-teal-600',     hotkey: 'C' },
  { key: 'drag',        label: 'Перетягування',   icon: <Move size={13} />,           color: 'bg-cyan-600',     hotkey: 'G' },
  { key: 'hover',       label: 'Навести',         icon: <Hand size={13} />,           color: 'bg-amber-500',    hotkey: 'H' },
  { key: 'ctrl_click',  label: 'Ctrl+Клік',      icon: <Keyboard size={13} />,       color: 'bg-purple-600',   hotkey: 'D' },
  { key: 'shift_click', label: 'Shift+Клік',     icon: <Keyboard size={13} />,       color: 'bg-fuchsia-600',  hotkey: 'F' },
  { key: 'pick',        label: 'Селектор',       icon: <Crosshair size={13} />,      color: 'bg-indigo-600',   hotkey: 'P' },
];

const StreamPicker: React.FC<StreamPickerProps> = ({ onClose, ws: propsWs, wsUrl, nodeId, pickType }) => {
  const [internalWs, setInternalWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!wsUrl) return;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => setInternalWs(socket);
    return () => socket.close();
  }, [wsUrl]);

  const ws = wsUrl ? internalWs : propsWs;
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('direct');
  const [isRecording, setIsRecording] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [devToolsUrl, setDevToolsUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Стан для перегляду коду сторінки та DOM інспектора
  const [pageSourceData, setPageSourceData] = useState<{
    projectName?: string;
    url: string;
    title: string;
    html: string;
    elements?: { tag: string; id: string; className: string; text: string; selector: string }[];
  } | null>(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceTab, setSourceTab] = useState<'html' | 'elements'>('html');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(false);

  // Стан бічного інспектора (Split-view екран браузера + код збоку)
  const [showSideInspector, setShowSideInspector] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState<{
    selector: string;
    tag?: string;
    text?: string;
    outerHTML?: string;
    attributes?: { name: string; value: string }[];
    parents?: { tag: string; selector: string; text?: string }[];
    children?: { tag: string; selector: string; text?: string; id?: string; className?: string }[];
    images?: { name: string; src: string; alt?: string; tag: string; selector: string; width?: number; height?: number }[];
    matchCount?: number;
  } | null>(null);
  const [interactiveElements, setInteractiveElements] = useState<{
    tag: string; id: string; className: string; text: string; selector: string
  }[]>([]);
  const [copiedSelector, setCopiedSelector] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isInspectClickActive, setIsInspectClickActive] = useState(true);
  const [elementSearch, setElementSearch] = useState('');

  const handleCopy = useCallback(async (text: string, key?: string) => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok && key) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }, []);


  // Додаткові інструменти керування
  const [textInput, setTextInput] = useState('');
  const [pressEnterAfterType, setPressEnterAfterType] = useState(true);
  const [navUrl, setNavUrl] = useState('');
  const [showNavToolbar, setShowNavToolbar] = useState(false);

  // Mouse drag tracking
  const isMouseDownRef = useRef(false);
  const mouseMoveThrottleRef = useRef<number>(0);
  const hoverThrottleRef = useRef<number>(0);
  const mouseDownPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const hasDraggedRef = useRef(false);

  // Touch pinch-to-zoom
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStartCenter, setTouchStartCenter] = useState<{ x: number; y: number } | null>(null);
  const [startScroll, setStartScroll] = useState<{ left: number; top: number } | null>(null);
  const [startZoom, setStartZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const naturalWidthRef = useRef<number>(1280);
  const naturalHeightRef = useRef<number>(720);
  const deviceWidthRef = useRef<number>(1280);
  const deviceHeightRef = useRef<number>(720);

  const scrollRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const drawFrame = useCallback((base64Data: string) => {
    try {
      fetch(`data:image/jpeg;base64,${base64Data}`)
        .then(r => r.blob())
        .then(blob => createImageBitmap(blob))
        .then((bmp) => {
          naturalWidthRef.current = bmp.width;
          naturalHeightRef.current = bmp.height;
          [canvasRef.current, fullscreenCanvasRef.current].forEach((cvs) => {
            if (cvs) {
              if (cvs.width !== bmp.width || cvs.height !== bmp.height) {
                cvs.width = bmp.width;
                cvs.height = bmp.height;
              }
              const ctx = cvs.getContext('2d');
              if (ctx) {
                ctx.drawImage(bmp, 0, 0);
              }
            }
          });
          bmp.close();
        })
        .catch(() => {});
    } catch {}
  }, []);

  const hasReceivedFrameRef = useRef(false);

  // ─── Отримуємо кадри трансляції ─────────────────────────────────────────────
  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STREAM_FRAME') {
          if (data.metadata?.deviceWidth) deviceWidthRef.current = data.metadata.deviceWidth;
          if (data.metadata?.deviceHeight) deviceHeightRef.current = data.metadata.deviceHeight;
          drawFrame(data.frame);
          if (!hasReceivedFrameRef.current) {
            hasReceivedFrameRef.current = true;
            setHasReceivedFrame(true);
            setLoading(false);
            setIsBrowserOpen(true);
          }
        } else if (data.type === 'DEVTOOLS_URL') {
          const isSecure = window.location.protocol === 'https:';
          const cdpPort = data.cdpPort || 9222;
          
          let newUrl = data.url;
          if (newUrl.startsWith('/')) {
            newUrl = `http://${window.location.hostname}:${cdpPort}${newUrl}`;
          }
          
          newUrl = newUrl
            .replace('ws=localhost:', `ws=${window.location.hostname}:`)
            .replace('ws=127.0.0.1:', `ws=${window.location.hostname}:`);
            
          if (isSecure) {
            newUrl = newUrl.replace('ws=', 'wss=');
            newUrl = newUrl.replace('http:', 'https:');
          }
          
          try {
            window.open(newUrl, '_blank', 'width=1200,height=800');
          } catch (e) {}
        } else if (data.type === 'SELECTOR_INFO_PICKED') {
          setSelectedElementInfo({
            selector: data.selector,
            tag: data.tag,
            text: data.text,
            outerHTML: data.outerHTML,
            attributes: data.attributes,
            parents: data.parents,
            children: data.children,
            images: data.images,
            matchCount: data.matchCount
          });
          setShowSideInspector(true);
        } else if (data.type === 'PAGE_SOURCE_DATA') {
          if (data.elements && data.elements.length > 0) {
            setInteractiveElements(data.elements);
          }
          setPageSourceData({
            projectName: data.projectName || 'SF',
            url: data.url || '',
            title: data.title || '',
            html: data.html || '',
            elements: data.elements || []
          });
          setIsLoadingSource(false);
        }
      } catch {}
    };
    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({ type: 'START_STREAM', nodeId }));
    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.send(JSON.stringify({ type: 'STOP_STREAM' }));
    };
  }, [ws, nodeId, drawFrame]);

  // Підсвічування селектора у браузері
  const highlightElement = useCallback((selector: string) => {
    if (!ws || !selector) return;
    ws.send(JSON.stringify({ type: 'HIGHLIGHT_SELECTOR', selector }));
  }, [ws]);

  const clearHighlight = useCallback(() => {
    if (!ws) return;
    ws.send(JSON.stringify({ type: 'CLEAR_HIGHLIGHT' }));
  }, [ws]);

  // ─── Обчислення координат відносно зображення ───────────────────────────────
  const getImgCoords = useCallback((e: React.MouseEvent | React.Touch, refOverride?: React.RefObject<HTMLDivElement | null>) => {
    const ref = refOverride || (isFullscreen ? fullscreenContainerRef : containerRef);
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : (e as React.Touch).clientX;
    const clientY = 'clientY' in e ? e.clientY : (e as React.Touch).clientY;
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const deviceWidth = deviceWidthRef.current || 1280;
    const deviceHeight = deviceHeightRef.current || 720;
    return {
      relX,
      relY,
      x: Math.round(relX * deviceWidth),
      y: Math.round(relY * deviceHeight),
    };
  }, [isFullscreen]);

  // ─── Допоміжна анімація кліку (Ripple) ──────────────────────────────────────
  const triggerRipple = useCallback((e: React.MouseEvent, colorClass: string) => {
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const rect = activeRef.current?.getBoundingClientRect();
    if (rect) {
      const rippleId = Date.now() + Math.random();
      const x = e.clientX - rect.left - 14;
      const y = e.clientY - rect.top - 14;
      setRipples(prev => [...prev, { id: rippleId, x, y, color: colorClass }]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== rippleId));
      }, 700);
    }
  }, [isFullscreen]);

  // ─── Відправка команд миші та взаємодії ─────────────────────────────────────
  const sendInteraction = useCallback((action: string, extra: Record<string, any> = {}) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'INTERACT_BROWSER',
      action,
      ...extra
    }));
  }, [ws]);

  // ─── Mouse Down ─────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const currentMode = modeRef.current;
    const isPickOrInspect = currentMode === 'pick' || (showSideInspector && isInspectClickActive);
    if (isPickOrInspect) {
      // 🛡️ У режимі вибору селектора чи інспектора блокуємо mousedown,
      // щоб клік не проходив у гру і модальні вікна чи елементи не зникали!
      return;
    }

    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;

    isMouseDownRef.current = true;
    mouseDownPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasDraggedRef.current = false;
    const buttonName = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

    if (currentMode === 'direct' || currentMode === 'drag') {
      sendInteraction('mousedown', { ...coords, button: buttonName });
    }
  }, [ws, getImgCoords, isFullscreen, sendInteraction, showSideInspector, isInspectClickActive]);

  // ─── Mouse Move ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (coords) setCursorPos(coords);
    if (!ws) return;

    const currentMode = modeRef.current;
    const isPickOrInspect = currentMode === 'pick' || (showSideInspector && isInspectClickActive);
    if (isPickOrInspect) return;

    const now = Date.now();

    // Якщо затиснута кнопка миші (перетягування карти / елементів)
    if (isMouseDownRef.current && (currentMode === 'direct' || currentMode === 'drag')) {
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.clientX);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.clientY);
        if (dx > 4 || dy > 4) {
          hasDraggedRef.current = true;
        }
      }
      if (now - mouseMoveThrottleRef.current > 30) {
        mouseMoveThrottleRef.current = now;
        if (coords) sendInteraction('mousemove', coords);
      }
      return;
    }

    // Режим hover
    if (currentMode === 'hover') {
      if (now - hoverThrottleRef.current > 60) {
        hoverThrottleRef.current = now;
        if (coords) sendInteraction('hover', coords);
      }
    }
  }, [ws, getImgCoords, isFullscreen, sendInteraction, showSideInspector, isInspectClickActive]);

  // ─── Mouse Up ───────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const currentMode = modeRef.current;
    const isPickOrInspect = currentMode === 'pick' || (showSideInspector && isInspectClickActive);
    if (isPickOrInspect) {
      isMouseDownRef.current = false;
      return;
    }

    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    const buttonName = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

    if (isMouseDownRef.current && (currentMode === 'direct' || currentMode === 'drag')) {
      isMouseDownRef.current = false;
      if (coords) {
        sendInteraction('mouseup', { ...coords, button: buttonName });
      }
    }
  }, [ws, getImgCoords, isFullscreen, sendInteraction, showSideInspector, isInspectClickActive]);

  // ─── Mouse Click ────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const currentMode = modeRef.current;
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;

    const isPickOrInspect = currentMode === 'pick' || (showSideInspector && isInspectClickActive);

    const colors: Record<Mode, string> = {
      direct: 'border-emerald-400', click: 'border-teal-400',
      drag: 'border-cyan-400', hover: 'border-amber-400',
      pick: 'border-indigo-400', ctrl_click: 'border-purple-400',
      shift_click: 'border-fuchsia-400',
    };
    triggerRipple(e, isPickOrInspect ? 'border-amber-400' : (colors[currentMode] || 'border-emerald-400'));

    if (isPickOrInspect) {
      e.preventDefault();
      e.stopPropagation();
      const isSmart = e.shiftKey ? window.confirm('Використати СМАРТ селектор? (OK = Смарт, Скасувати = Стандарт)') : false;
      ws.send(JSON.stringify({
        type: 'PICK_SELECTOR_BY_COORDS',
        action: 'pick',
        ...coords, nodeId, pickType, isSmart,
      }));
      return;
    }

    if (currentMode === 'direct') {
      if (!hasDraggedRef.current) {
        sendInteraction('click', coords);
      }
      return;
    }

    sendInteraction(currentMode, coords);

    if (isRecording) {
      ws.send(JSON.stringify({ type: 'RECORD_NODE', ...coords }));
    }

    if (currentMode === 'ctrl_click' || currentMode === 'shift_click') {
      setTimeout(() => setMode('direct'), 150);
    }
  }, [ws, nodeId, pickType, isRecording, getImgCoords, isFullscreen, triggerRipple, sendInteraction, showSideInspector, isInspectClickActive]);

  // ─── Right Click (Context Menu) ─────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!ws) return;
    const isPickOrInspect = modeRef.current === 'pick' || (showSideInspector && isInspectClickActive);
    if (isPickOrInspect) return;

    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;
    triggerRipple(e, 'border-rose-400');
    sendInteraction('right_click', coords);
  }, [ws, getImgCoords, isFullscreen, triggerRipple, sendInteraction, showSideInspector, isInspectClickActive]);

  // ─── Double Click ───────────────────────────────────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const isPickOrInspect = modeRef.current === 'pick' || (showSideInspector && isInspectClickActive);
    if (isPickOrInspect) return;

    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;
    triggerRipple(e, 'border-blue-400');
    sendInteraction('double_click', coords);
  }, [ws, getImgCoords, isFullscreen, triggerRipple, sendInteraction, showSideInspector, isInspectClickActive]);

  // ─── Scroll на кадрі ────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!ws) return;
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(z => Math.max(1, Math.min(4, z - e.deltaY * 0.002)));
    } else {
      const coords = getImgCoords(e as any);
      if (coords) {
        sendInteraction('scroll', {
          x: coords.x,
          y: coords.y,
          deltaX: Math.round(e.deltaX),
          deltaY: Math.round(e.deltaY),
        });
      }
    }
  }, [ws, getImgCoords, sendInteraction]);

  // ─── Touch Pinch / Drag ─────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    const isPickOrInspect = modeRef.current === 'pick' || (showSideInspector && isInspectClickActive);
    if (isPickOrInspect) {
      if (e.touches.length === 1) {
        const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
        const coords = getImgCoords(e.touches[0] as any, activeRef);
        if (coords) {
          ws?.send(JSON.stringify({
            type: 'PICK_SELECTOR_BY_COORDS',
            action: 'pick',
            ...coords, nodeId, pickType, isSmart: false,
          }));
        }
      }
      return;
    }

    if (e.touches.length === 1) {
      const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
      const coords = getImgCoords(e.touches[0] as any, activeRef);
      if (coords && (modeRef.current === 'direct' || modeRef.current === 'drag')) {
        isMouseDownRef.current = true;
        sendInteraction('mousedown', { ...coords, button: 'left' });
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY,
      );
      setTouchStartDist(dist);
      setTouchStartCenter({ x: (e.touches[0].pageX + e.touches[1].pageX) / 2, y: (e.touches[0].pageY + e.touches[1].pageY) / 2 });
      setStartZoom(zoom);
      if (scrollRef.current) setStartScroll({ left: scrollRef.current.scrollLeft, top: scrollRef.current.scrollTop });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isMouseDownRef.current) {
      const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
      const coords = getImgCoords(e.touches[0] as any, activeRef);
      const now = Date.now();
      if (coords && now - mouseMoveThrottleRef.current > 30) {
        mouseMoveThrottleRef.current = now;
        sendInteraction('mousemove', coords);
      }
    } else if (e.touches.length === 2 && touchStartDist !== null && touchStartCenter && startScroll) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      setZoom(Math.max(1, Math.min(4, startZoom * (dist / touchStartDist))));
      const cx = (e.touches[0].pageX + e.touches[1].pageX) / 2;
      const cy = (e.touches[0].pageY + e.touches[1].pageY) / 2;
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = startScroll.left - (cx - touchStartCenter.x);
        scrollRef.current.scrollTop = startScroll.top - (cy - touchStartCenter.y);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
      const coords = cursorPos || { x: 0, y: 0 };
      sendInteraction('mouseup', { ...coords, button: 'left' });
    }
    setTouchStartDist(null);
  };

  // ─── Клавіатурні скорочення ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (isFullscreen) { setIsFullscreen(false); return; }
        onClose();
        return;
      }

      // Перемикання режиму гарячими клавішами
      const keyUpper = e.key.toUpperCase();
      const found = MODES.find(m => m.hotkey === keyUpper);
      if (found) { e.preventDefault(); setMode(found.key); return; }

      // Зум
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => Math.min(4, z + 0.25)); return; }
      if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(1, z - 0.25)); return; }
      if (e.key === '0') { e.preventDefault(); setZoom(1); return; }

      // F1 / F5
      if (e.key === 'F1') {
        e.preventDefault();
        sendInteraction('esc');
      } else if (e.key === 'F5') {
        e.preventDefault();
        sendInteraction('reload');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, onClose, sendInteraction]);

  // ─── Відправка тексту в браузер ─────────────────────────────────────────────
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !ws) return;
    sendInteraction('type_text', { text: textInput });
    if (pressEnterAfterType) {
      setTimeout(() => sendInteraction('enter'), 50);
    }
    setTextInput('');
  };

  // ─── Відправка навігації за URL ──────────────────────────────────────────────
  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!navUrl.trim() || !ws) return;
    sendInteraction('navigate', { url: navUrl.trim() });
  };

  // ─── Рендер полотна трансляції ──────────────────────────────────────────────
  const renderFrame = (refToUse: React.RefObject<HTMLDivElement | null>, isFull: boolean) => hasReceivedFrame && (
    <div
      ref={refToUse}
      tabIndex={0}
      className={`relative w-full ${isFull ? 'h-full' : 'h-auto'} group touch-auto outline-none select-none`}
      style={{
        cursor: mode === 'hover' ? 'crosshair' : mode === 'drag' ? 'grab' : mode === 'pick' ? 'crosshair' : 'default'
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onMouseLeave={() => {
        setCursorPos(null);
        if (isMouseDownRef.current) {
          isMouseDownRef.current = false;
          sendInteraction('mouseup', { x: 0, y: 0, button: 'left' });
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={isFull ? fullscreenCanvasRef : canvasRef}
        className="w-full h-auto block select-none"
        style={{ imageRendering: zoom > 1.5 ? 'pixelated' : 'auto' }}
      />

      {/* Анімації кліку (Ripples) */}
      {ripples.map(r => (
        <div 
          key={r.id} 
          className={`absolute w-7 h-7 border-2 ${r.color} rounded-full animate-ping pointer-events-none z-[var(--z-special)]`} 
          style={{ left: r.x, top: r.y }} 
        />
      ))}

      {/* Координати + статус */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-full text-[10px] text-white/90 font-mono border border-white/10 shadow-lg">
          <MousePointer size={11} className="text-emerald-400 shrink-0" />
          {cursorPos
            ? <span>X: <strong className="text-white">{cursorPos.x}</strong> Y: <strong className="text-white">{cursorPos.y}</strong></span>
            : <span className="opacity-60">наведіть на кадр</span>
          }
        </div>
        <div className="flex items-center gap-1.5">
          {(() => {
            const m = MODES.find(m => m.key === mode);
            return m ? (
              <div className={`flex items-center gap-1 px-2.5 py-1 ${m.color}/90 backdrop-blur-md rounded-full text-[10px] text-white font-bold border border-white/20 shadow-lg`}>
                {m.icon}
                <span className="hidden sm:inline">{m.label}</span>
              </div>
            ) : null;
          })()}
          <div className="px-2.5 py-1 bg-red-600/90 backdrop-blur-md rounded-full text-[10px] text-white font-black border border-white/20 shadow-lg flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Панель швидких клавіш та введення тексту ──────────────────────────────
  const renderControlBar = (isFull: boolean) => (
    <div className={`flex flex-col gap-2 p-2.5 bg-black/85 backdrop-blur-md border-t border-white/10 text-white shrink-0 ${isFull ? 'z-20' : ''}`}>
      {/* Рядок 1: Форма введення тексту */}
      <div className="flex items-center gap-1.5">
        <form onSubmit={handleSendText} className="flex-1 flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Введіть текст для передачі у браузер..."
              className="w-full px-3 py-1.5 bg-white/10 border border-white/15 rounded-lg text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-xs font-bold text-white transition-all shadow-sm shrink-0"
            title="Надіслати текст"
          >
            <Send size={12} />
            <span className="hidden sm:inline">Надіслати</span>
          </button>
        </form>

        <label className="flex items-center gap-1 text-[10px] text-white/70 hover:text-white cursor-pointer px-1.5 py-1 bg-white/5 rounded-md border border-white/10 select-none shrink-0" title="Натиснути Enter після вставки тексту">
          <input
            type="checkbox"
            checked={pressEnterAfterType}
            onChange={(e) => setPressEnterAfterType(e.target.checked)}
            className="accent-emerald-500 rounded scale-90"
          />
          <span className="hidden md:inline">+ Enter</span>
        </label>

        <button
          type="button"
          onClick={() => setShowNavToolbar(!showNavToolbar)}
          className={`p-1.5 rounded-lg text-xs transition-colors border ${showNavToolbar ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'}`}
          title="Панель URL навігації"
        >
          <Globe size={14} />
        </button>
      </div>

      {/* Рядок навігації за URL (якщо відкритий) */}
      {showNavToolbar && (
        <form onSubmit={handleNavigate} className="flex items-center gap-1.5 animate-in slide-in-from-top-2 duration-150">
          <input
            type="text"
            value={navUrl}
            onChange={(e) => setNavUrl(e.target.value)}
            placeholder="Введіть URL (наприклад: https://sunflower-land.com/play/)"
            className="flex-1 px-3 py-1 bg-white/10 border border-white/15 rounded-lg text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white transition-all shrink-0"
          >
            Перейти
          </button>
        </form>
      )}

      {/* Рядок 2: Швидкі клавіші та дії */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
        {/* Кнопки клавіш */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => sendInteraction('enter')} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-mono font-bold text-[10px] text-white flex items-center gap-1" title="Натиснути Enter">
            <CornerDownLeft size={10} /> Enter
          </button>
          <button onClick={() => sendInteraction('esc')} className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 rounded font-mono font-bold text-[10px] text-white" title="Натиснути ESC">
            ESC
          </button>
          <button onClick={() => sendInteraction('tab')} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-mono font-bold text-[10px] text-white/80" title="Натиснути Tab">
            Tab
          </button>
          <button onClick={() => sendInteraction('backspace')} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-mono font-bold text-[10px] text-white/80" title="Backspace">
            ⌫ Backspace
          </button>
          <button onClick={() => sendInteraction('type_text', { text: ' ' })} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-mono font-bold text-[10px] text-white/80" title="Пробіл">
            Space
          </button>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Стрілки */}
          <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
            <button onClick={() => sendInteraction('keypress', { key: 'ArrowLeft' })} className="p-1 hover:bg-white/15 rounded text-white/80" title="Вліво"><ChevronLeft size={12} /></button>
            <button onClick={() => sendInteraction('keypress', { key: 'ArrowUp' })} className="p-1 hover:bg-white/15 rounded text-white/80" title="Вгору"><ChevronUp size={12} /></button>
            <button onClick={() => sendInteraction('keypress', { key: 'ArrowDown' })} className="p-1 hover:bg-white/15 rounded text-white/80" title="Вниз"><ChevronDown size={12} /></button>
            <button onClick={() => sendInteraction('keypress', { key: 'ArrowRight' })} className="p-1 hover:bg-white/15 rounded text-white/80" title="Вправо"><ChevronRight size={12} /></button>
          </div>
        </div>

        {/* Браузерні навігаційні кнопки */}
        <div className="flex items-center gap-1">
          <button onClick={() => sendInteraction('go_back')} className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/80" title="Назад"><ArrowLeft size={12} /></button>
          <button onClick={() => sendInteraction('go_forward')} className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/80" title="Вперед"><ArrowRight size={12} /></button>
          <button onClick={() => sendInteraction('reload')} className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-bold text-[10px] text-white/90" title="Оновити сторінку (F5)">
            <RotateCcw size={11} />
            <span className="hidden sm:inline">Оновити</span>
          </button>
          <button onClick={() => sendInteraction('scroll_up')} className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/70" title="Скрол вгору"><ChevronUp size={12} /></button>
          <button onClick={() => sendInteraction('scroll_down')} className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/70" title="Скрол вниз"><ChevronDown size={12} /></button>
        </div>
      </div>
    </div>
  );

  // ─── Бічна панель інспектора коду (Split-View) ─────────────────────────────
  const renderSideInspector = () => (
    <div className="w-full md:w-96 lg:w-[440px] flex flex-col bg-[#0b0f19] text-white shrink-0 border-t md:border-t-0 md:border-l border-white/10 overflow-hidden animate-in slide-in-from-right-3 duration-200">
      {/* Заголовок */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-white/10 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <PanelRight size={15} className="text-amber-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Інспектор коду</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsInspectClickActive(!isInspectClickActive)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border shadow-sm ${
              isInspectClickActive
                ? 'bg-amber-500 text-black border-amber-400 font-extrabold'
                : 'bg-white/10 text-white/70 hover:text-white border-white/10'
            }`}
            title={isInspectClickActive ? "Клік на трансляцію вибирає елемент без спрацювання кліку в браузері (елементи та модалки не зникають). Натисніть щоб перейти в режим прямого керування" : "Пряме керування браузером. Натисніть щоб увімкнути безпечний вибір селекторів"}
          >
            {isInspectClickActive ? <Shield size={11} className="text-black" /> : <Crosshair size={11} />}
            <span>{isInspectClickActive ? 'Вибір (клік заблоковано)' : 'Керування'}</span>
          </button>

          {selectedElementInfo && (
            <button
              onClick={() => {
                clearHighlight();
                setSelectedElementInfo(null);
              }}
              className="px-2 py-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-all"
              title="Скинути підсвічування"
            >
              Скинути
            </button>
          )}

          <button
            onClick={() => {
              clearHighlight();
              setShowSideInspector(false);
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Сховати бічну панель"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Основна область інспектора */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs">
        {selectedElementInfo ? (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Карточка вибраного елемента */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-amber-500/30 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40">
                    &lt;{selectedElementInfo.tag}&gt;
                  </span>
                  {selectedElementInfo.matchCount !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      selectedElementInfo.matchCount === 1
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {selectedElementInfo.matchCount === 1 ? '1 унікальний' : `${selectedElementInfo.matchCount} збігів`}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => highlightElement(selectedElementInfo.selector)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                  title="Підсвітити елемент на екрані браузера"
                >
                  <Eye size={12} />
                  <span>Підсвітити</span>
                </button>
              </div>

              {/* Текст елемента */}
              {selectedElementInfo.text && (
                <div className="text-[11px] text-slate-300 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800 font-sans break-words">
                  «{selectedElementInfo.text}»
                </div>
              )}

              {/* Поле селектора */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">CSS Селектор:</span>
                  <button
                    onClick={async () => {
                      const ok = await copyToClipboard(selectedElementInfo.selector);
                      if (ok) {
                        setCopiedSelector(true);
                        setTimeout(() => setCopiedSelector(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium"
                  >
                    {copiedSelector ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedSelector ? 'Скопійовано!' : 'Копіювати'}</span>
                  </button>
                </div>
                <div
                  onClick={() => highlightElement(selectedElementInfo.selector)}
                  className="p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-200/90 break-all cursor-pointer hover:border-amber-500/60 hover:bg-slate-900 transition-colors shadow-inner"
                  title="Клікніть щоб підсвітити елемент у браузері"
                >
                  {selectedElementInfo.selector}
                </div>
              </div>

              {/* ─── Зображення всередині вибраного елемента ─── */}
              {selectedElementInfo.images && selectedElementInfo.images.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Image size={12} />
                      <span>Зображення в елементі ({selectedElementInfo.images.length}):</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-normal">клік для підсвічування</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                    {selectedElementInfo.images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => highlightElement(img.selector)}
                        className="group flex items-center gap-2 p-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-lg cursor-pointer transition-all text-[11px]"
                        title={`Клікніть щоб підсвітити в браузері: ${img.selector}`}
                      >
                        {/* Прев'ю */}
                        <div className="w-8 h-8 rounded bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:6px_6px]">
                          {img.src ? (
                            <img
                              src={img.src}
                              alt={img.name}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-[8px] font-mono font-bold text-amber-400 uppercase">{img.tag}</span>
                          )}
                        </div>

                        {/* Назва та інформація про зображення */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 font-bold text-slate-200 truncate">
                            <span className="truncate text-emerald-300 font-mono text-[11px]">{img.name}</span>
                            {img.width && img.height && (
                              <span className="text-[9px] text-slate-500 shrink-0 font-normal">({img.width}x{img.height})</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate opacity-80" title={img.selector}>
                            {img.selector}
                          </div>
                        </div>

                        {/* Кнопки копіювання */}
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleCopy(img.name, `img-name-${idx}`)}
                            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-emerald-300 transition-colors"
                            title={copiedKey === `img-name-${idx}` ? "Назву скопійовано!" : "Скопіювати назву файлу / зображення"}
                          >
                            {copiedKey === `img-name-${idx}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                          <button
                            onClick={() => handleCopy(img.selector, `img-css-${idx}`)}
                            className="px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-0.5"
                            title={copiedKey === `img-css-${idx}` ? "CSS селектор скопійовано!" : "Скопіювати CSS селектор зображення"}
                          >
                            {copiedKey === `img-css-${idx}` ? <Check size={10} className="text-emerald-400" /> : null}
                            <span>{copiedKey === `img-css-${idx}` ? 'OK' : 'CSS'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Вкладені (дочірні) елементи ─── */}
              {selectedElementInfo.children && selectedElementInfo.children.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <FolderTree size={12} />
                      <span>Вкладені елементи ({selectedElementInfo.children.length}):</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-normal">клік для вибору</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                    {selectedElementInfo.children.map((c, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center gap-1 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-cyan-500/60 rounded px-1.5 py-0.5 transition-all text-[10px]"
                      >
                        <button
                          onClick={() => highlightElement(c.selector)}
                          className="font-mono text-cyan-300 group-hover:text-white flex items-center gap-1 text-left"
                          title={`Селектор: ${c.selector}\nКлікніть щоб вибрати та підсвітити`}
                        >
                          <span>&lt;{c.tag}&gt;</span>
                          {c.text && <span className="text-slate-300 truncate max-w-[80px]">({c.text})</span>}
                          {c.id && <span className="text-amber-300 truncate max-w-[60px]">#{c.id}</span>}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(c.selector, `child-${idx}`);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-amber-400 transition-opacity text-slate-400"
                          title={copiedKey === `child-${idx}` ? "Скопійовано!" : "Скопіювати селектор"}
                        >
                          {copiedKey === `child-${idx}` ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Ієрархія батьківських елементів ─── */}
              {selectedElementInfo.parents && selectedElementInfo.parents.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Layers size={12} />
                      <span>Батьківські елементи ({selectedElementInfo.parents.length}):</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-normal">клік для вибору</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedElementInfo.parents.map((p, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded px-2 py-0.5 transition-all text-[10px]"
                      >
                        <button
                          onClick={() => highlightElement(p.selector)}
                          className="font-mono text-slate-300 hover:text-white flex items-center gap-1 text-left"
                          title={`Селектор: ${p.selector}\nКлікніть щоб вибрати та підсвітити`}
                        >
                          <span>&lt;{p.tag}&gt;</span>
                          {p.text && <span className="opacity-60 truncate max-w-[70px]">({p.text})</span>}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(p.selector, `parent-${idx}`);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-amber-400 transition-opacity text-slate-400"
                          title={copiedKey === `parent-${idx}` ? "Скопійовано!" : "Скопіювати селектор батька"}
                        >
                          {copiedKey === `parent-${idx}` ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* HTML код вибраного елемента */}
            {selectedElementInfo.outerHTML && (
              <div className="bg-slate-900/90 rounded-xl p-3 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Code size={11} className="text-blue-400" />
                    <span>HTML код елемента:</span>
                  </span>
                  <button
                    onClick={() => handleCopy(selectedElementInfo.outerHTML || '', 'outer-html')}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
                    title={copiedKey === 'outer-html' ? "HTML скопійовано!" : "Скопіювати HTML"}
                  >
                    {copiedKey === 'outer-html' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedKey === 'outer-html' ? 'Скопійовано!' : 'Копіювати'}</span>
                  </button>
                </div>
                <pre
                  onClick={() => highlightElement(selectedElementInfo.selector)}
                  className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10.5px] leading-relaxed text-slate-300 overflow-x-auto max-h-56 custom-scrollbar cursor-pointer hover:border-cyan-500/40 transition-colors"
                  title="Клікніть, щоб підсвітити елемент у браузері"
                >
                  <code>{selectedElementInfo.outerHTML}</code>
                </pre>
              </div>
            )}
          </div>
        ) : (
          /* Коли ще нічого не вибрано */
          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-900/50 rounded-xl border border-dashed border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crosshair size={20} />
            </div>
            <div>
              <div className="font-bold text-slate-200 text-xs">Оберіть елемент у браузері</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Клікніть мишкою на будь-який об'єкт на екрані трансляції зліва. Тут відобразиться його код, тег і точний селектор.
              </p>
            </div>
          </div>
        )}

        {/* Список елементів на сторінці */}
        <div className="bg-slate-900/80 rounded-xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-400" />
              <span>Елементи сторінки ({interactiveElements.length}):</span>
            </span>

            {interactiveElements.length === 0 && (
              <button
                onClick={() => ws?.send(JSON.stringify({ type: 'GET_PAGE_SOURCE' }))}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
              >
                <RefreshCw size={10} />
                <span>Завантажити</span>
              </button>
            )}
          </div>

          {interactiveElements.length > 0 && (
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={elementSearch}
                onChange={(e) => setElementSearch(e.target.value)}
                placeholder="Фільтр елементів (button, id, text)..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[11px] pl-6 pr-2 py-1 rounded-lg focus:outline-none focus:border-amber-500/60 font-sans"
              />
            </div>
          )}

          {interactiveElements.length > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {interactiveElements
                .filter(el => {
                  if (!elementSearch.trim()) return true;
                  const q = elementSearch.toLowerCase();
                  return (
                    el.tag.toLowerCase().includes(q) ||
                    el.id.toLowerCase().includes(q) ||
                    el.className.toLowerCase().includes(q) ||
                    el.text.toLowerCase().includes(q) ||
                    el.selector.toLowerCase().includes(q)
                  );
                })
                .slice(0, 40)
                .map((el, i) => (
                  <div
                    key={i}
                    onClick={() => highlightElement(el.selector)}
                    className="group flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all text-[11px]"
                    title={`Клікніть щоб підсвітити в браузері: ${el.selector}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[9px] uppercase shrink-0">
                        {el.tag}
                      </span>
                      <span className="text-slate-300 truncate font-sans text-[11px]">
                        {el.text || el.id || el.className || el.selector}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(el.selector, `interactive-${i}`);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-opacity shrink-0"
                      title={copiedKey === `interactive-${i}` ? "Скопійовано!" : "Скопіювати селектор"}
                    >
                      {copiedKey === `interactive-${i}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── 1. Повноекранний режим ─────────────────────────────────────────────────
  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-[var(--z-modal-high)] bg-black flex flex-col animate-in fade-in duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Верхня панель режимів */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/85 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            {MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all shrink-0 ${
                  mode === m.key ? `${m.color} text-white shadow-md` : 'bg-white/10 text-white/60 hover:text-white'
                }`}
                title={`${m.label} (${m.hotkey})`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Код збоку */}
            <button
              onClick={() => {
                const next = !showSideInspector;
                setShowSideInspector(next);
                if (next && interactiveElements.length === 0) {
                  ws?.send(JSON.stringify({ type: 'GET_PAGE_SOURCE' }));
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${
                showSideInspector
                  ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-sm'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/30'
              }`}
              title="Код збоку (Split Inspector)"
            >
              <PanelRight size={13} />
              <span className="hidden sm:inline">Код збоку</span>
            </button>

            <button
              onClick={() => {
                setIsFullscreen(false);
                if (pageSourceData) {
                  setPageSourceData(null);
                } else {
                  setIsLoadingSource(true);
                  ws?.send(JSON.stringify({ type: 'GET_PAGE_SOURCE' }));
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/90 hover:bg-blue-600 rounded-lg text-[10px] font-black text-white uppercase"
              title="Код сторінки (HTML & DOM інспектор)"
            >
              {isLoadingSource ? <Loader2 size={13} className="animate-spin" /> : <Code size={13} />}
              <span className="hidden sm:inline">Код сторінки</span>
            </button>

            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white"
              title="Вийти з повноекранного режиму (ESC)"
            >
              <Minimize2 size={16} />
            </button>

            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white" title="Закрити (ESC)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Кадр на весь екран або спліт із бічною панеллю */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-black">
          <div className="flex-1 overflow-auto relative bg-black flex items-center justify-center min-w-0">
            {renderFrame(fullscreenContainerRef, true)}
          </div>
          {showSideInspector && renderSideInspector()}
        </div>

        {/* Нижня панель керування */}
        {renderControlBar(true)}
      </div>
    );
  }

  // ─── 2. Модалка коду сторінки та DOM-інспектора ──────────────────────────────
  if (pageSourceData) {
    const s = sourceSearch.toLowerCase().trim();
    const filteredElements = (pageSourceData.elements || []).filter(el => {
      if (!s) return true;
      return (
        el.tag.toLowerCase().includes(s) ||
        el.id.toLowerCase().includes(s) ||
        el.className.toLowerCase().includes(s) ||
        el.text.toLowerCase().includes(s) ||
        el.selector.toLowerCase().includes(s)
      );
    });

    const lines = pageSourceData.html.split('\n');
    const filteredLines = s 
      ? lines.map((l, i) => ({ line: l, num: i + 1 })).filter(item => item.line.toLowerCase().includes(s))
      : lines.map((l, i) => ({ line: l, num: i + 1 }));

    return (
      <div 
        className="fixed inset-0 z-[var(--z-stream-picker)] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200" 
        onClick={() => setPageSourceData(null)}
      >
        <div 
          className="relative w-full max-w-6xl h-[90vh] bg-[#0b0f19] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Верхня панель */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-white/10 shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <Code size={16} className="text-blue-400 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wider text-white shrink-0">Код сторінки & Інспектор</span>
              {pageSourceData.url && (
                <span className="hidden md:inline-block text-[11px] text-slate-400 font-mono truncate max-w-xs bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60" title={pageSourceData.url}>
                  {pageSourceData.url}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Пошук */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Пошук у коді..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs pl-7 pr-5 py-1 rounded-lg w-36 sm:w-48 focus:outline-none focus:border-blue-500 font-sans"
                />
                {sourceSearch && (
                  <button 
                    onClick={() => setSourceSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Перемикач вкладок */}
              <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
                <button
                  onClick={() => setSourceTab('html')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                    sourceTab === 'html' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  HTML код
                </button>
                <button
                  onClick={() => setSourceTab('elements')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                    sourceTab === 'elements' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Селектори ({pageSourceData.elements?.length || 0})
                </button>
              </div>

              {/* Кнопка Скопіювати */}
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(pageSourceData.html);
                  if (ok) {
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                title="Скопіювати весь HTML код"
              >
                {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span className="hidden sm:inline">{copiedCode ? 'Скопійовано!' : 'Копіювати'}</span>
              </button>

              {/* Оновити */}
              <button
                onClick={() => {
                  setIsLoadingSource(true);
                  ws?.send(JSON.stringify({ type: 'GET_PAGE_SOURCE' }));
                }}
                disabled={isLoadingSource}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                title="Оновити поточний HTML з браузера"
              >
                <RefreshCw size={12} className={isLoadingSource ? 'animate-spin text-blue-400' : ''} />
                <span className="hidden sm:inline">Оновити</span>
              </button>

              {/* Відкрити у новому вікні */}
              <button
                onClick={() => {
                  window.open(`/api/browser/page-source/${pageSourceData.projectName || 'SF'}`, '_blank');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
                title="Відкрити HTML код сторінки у новій вкладці"
              >
                <ExternalLink size={12} />
                <span className="hidden sm:inline">В окремому вікні</span>
              </button>

              {/* Закрити */}
              <button 
                onClick={() => setPageSourceData(null)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Повернутися до трансляції (ESC)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Вміст */}
          <div className="flex-1 overflow-auto bg-[#060911] p-4 text-xs font-mono select-text">
            {sourceTab === 'html' ? (
              <div className="space-y-0.5">
                {sourceSearch && (
                  <div className="mb-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-[11px] font-sans">
                    Знайдено рядків: {filteredLines.length} із {lines.length}.
                  </div>
                )}
                {filteredLines.map((item) => (
                  <div key={item.num} className="flex hover:bg-slate-800/40 rounded px-1 group">
                    <span className="w-12 shrink-0 text-slate-600 select-none text-right pr-3 font-mono">{item.num}</span>
                    <span className="text-slate-300 break-all whitespace-pre-wrap flex-1">{item.line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 font-sans">
                <div className="text-[11px] text-slate-400 mb-2">
                  Клікніть «Скопіювати», щоб скопіювати готовий CSS селектор елемента для ноди:
                </div>
                {filteredElements.map((el, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 rounded-xl gap-3 transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase shrink-0">
                        {el.tag}
                      </span>
                      {el.text && (
                        <span className="text-slate-200 truncate text-xs max-w-[200px]">
                          "{el.text}"
                        </span>
                      )}
                      <code className="text-slate-400 text-[11px] truncate bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                        {el.selector}
                      </code>
                    </div>
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(el.selector);
                        if (ok) {
                          alert(`Селектор скопійовано:\n${el.selector}`);
                        }
                      }}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all"
                    >
                      <Copy size={11} />
                      <span>Скопіювати</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. Звичайний режим трансляції ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[var(--z-stream-picker)] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className={`relative w-full ${showSideInspector ? 'max-w-7xl' : 'max-w-5xl'} flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl flex transition-all duration-300 max-h-[95vh]`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col flex-1 h-full min-w-0">
          {/* Верхня панель */}
          <div className="flex flex-col border-b border-white/10 bg-white/5 shrink-0 backdrop-blur-md">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    if (isBrowserOpen) {
                      ws?.send(JSON.stringify({ type: 'CLOSE_BROWSER' }));
                      setIsBrowserOpen(false);
                      setDevToolsUrl(null);
                    } else {
                      const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
                      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
                      const projName = localStorage.getItem('sfl_current_project') || 'default';
                      const savedBrowser = localStorage.getItem(`sfl_browser_${projName}`);
                      const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
                      const settings = { ...globalSettings, ...browserSettings };
                      ws?.send(JSON.stringify({ type: 'LAUNCH_BROWSER', settings }));
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${
                    isBrowserOpen 
                      ? 'bg-rose-600/90 text-white hover:bg-rose-600' 
                      : 'bg-emerald-600/90 text-white hover:bg-emerald-600'
                  }`}
                  title={isBrowserOpen ? "Зупинити браузер" : "Запустити браузер"}
                >
                  {isBrowserOpen ? <Power size={14} /> : <Play size={14} fill="currentColor" />}
                  <span>{isBrowserOpen ? "Стоп" : "Старт"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Запис */}
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    isRecording ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
                  <span>{isRecording ? 'REC...' : 'Запис'}</span>
                </button>

                {/* Zoom */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                  <button onClick={() => setZoom(z => Math.max(1, z - 0.25))} className="px-2 py-1.5 hover:bg-white/10 text-white/60 hover:text-white"><ZoomOut size={13} /></button>
                  <button onClick={() => setZoom(1)} className="px-2 py-1.5 text-[10px] font-bold min-w-[42px] text-center hover:bg-white/10 border-x border-white/10 text-white/80">{Math.round(zoom * 100)}%</button>
                  <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="px-2 py-1.5 hover:bg-white/10 text-white/60 hover:text-white"><ZoomIn size={13} /></button>
                </div>

                {/* Fullscreen */}
                <button onClick={() => setIsFullscreen(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white" title="Повний екран">
                  <Maximize2 size={16} />
                </button>

                {/* Закрити */}
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white" title="Закрити (ESC)">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Рядок режимів */}
            <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
              {MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => {
                    setMode(m.key);
                    if (m.key === 'pick') ws?.send(JSON.stringify({ type: 'ACTIVATE_PICKER', nodeId, pickType }));
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    mode === m.key
                      ? `${m.color} text-white shadow-md scale-[1.03] ring-2 ring-offset-1 ring-offset-background ${m.color.replace('bg-', 'ring-')}`
                      : 'bg-muted text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                  title={`${m.label} (${m.hotkey})`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                  <kbd className="ml-1 text-[8px] opacity-50 font-mono hidden md:inline">{m.hotkey}</kbd>
                </button>
              ))}

              <div className="flex-1" />

              {/* Код збоку */}
              <button
                onClick={() => {
                  const next = !showSideInspector;
                  setShowSideInspector(next);
                  if (next && interactiveElements.length === 0) {
                    ws?.send(JSON.stringify({ type: 'GET_PAGE_SOURCE' }));
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm border ${
                  showSideInspector
                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-md ring-2 ring-amber-400/50'
                    : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border-amber-500/30'
                }`}
                title="Режим інспектора: екран браузера зліва, код та селектори збоку"
              >
                <PanelRight size={13} />
                <span>Код збоку</span>
              </button>

              {/* Код сторінки */}
              <button
                onClick={() => {
                  if (pageSourceData) {
                    setPageSourceData(null);
                  } else {
                    setIsLoadingSource(true);
                    ws?.send(JSON.stringify({ type: 'GET_PAGE_SOURCE' }));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 border border-blue-500/30"
                title="Відкрити код сторінки (HTML & DOM інспектор)"
              >
                {isLoadingSource ? <Loader2 size={12} className="animate-spin" /> : <Code size={12} />}
                <span>Повний код</span>
              </button>
            </div>
          </div>

          {/* Основний блок: кадр трансляції + бічна панель (Split-View) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[350px] max-h-[65vh]">
            <div ref={scrollRef} className="relative flex-1 bg-black/40 overflow-auto touch-none backdrop-blur-sm flex items-center justify-center min-w-0">
              {showSideInspector && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/90 text-black font-bold text-[10px] rounded-lg shadow-lg pointer-events-none select-none">
                  <Sparkles size={11} />
                  <span>{isInspectClickActive ? "Клікніть на об'єкт у браузері для вибору коду" : "Пряме керування сторінкою"}</span>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground py-20">
                  <Loader2 size={36} className="animate-spin text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Підключення до трансляції...</span>
                </div>
              )}

              {hasReceivedFrame && (
                <div className="relative w-full" style={{ width: zoom > 1 ? `${zoom * 100}%` : '100%' }}>
                  {renderFrame(containerRef, false)}
                </div>
              )}
            </div>

            {showSideInspector && renderSideInspector()}
          </div>

          {/* Нижня панель керування */}
          {renderControlBar(false)}
        </div>
      </div>
    </div>
  );
};

export default StreamPicker;
