// Панель трансляції з живого браузера — повне керування мишею (drag, right-click), клавіатурою, введенням тексту і тач-зумом
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, MousePointer, MousePointer2, Loader2, ZoomIn, ZoomOut,
  Mouse, Hand, Keyboard,
  Power, Play, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Code, Maximize2, Minimize2, RotateCcw, ArrowLeft, ArrowRight,
  CornerDownLeft, Move, Crosshair, Send, Globe
} from 'lucide-react';

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

  // Додаткові інструменти керування
  const [textInput, setTextInput] = useState('');
  const [pressEnterAfterType, setPressEnterAfterType] = useState(true);
  const [navUrl, setNavUrl] = useState('');
  const [showNavToolbar, setShowNavToolbar] = useState(false);

  // Mouse drag tracking
  const isMouseDownRef = useRef(false);
  const mouseMoveThrottleRef = useRef<number>(0);
  const hoverThrottleRef = useRef<number>(0);

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
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: 'image/jpeg' });
      createImageBitmap(blob).then((bmp) => {
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
      }).catch(() => {});
    } catch {}
  }, []);

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
          setHasReceivedFrame(true);
          setLoading(false);
          setIsBrowserOpen(true);
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
          setDevToolsUrl(newUrl);
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
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;

    isMouseDownRef.current = true;
    const buttonName = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

    if (currentMode === 'direct' || currentMode === 'drag') {
      sendInteraction('mousedown', { ...coords, button: buttonName });
    }
  }, [ws, getImgCoords, isFullscreen, sendInteraction]);

  // ─── Mouse Move ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (coords) setCursorPos(coords);
    if (!ws) return;

    const currentMode = modeRef.current;
    const now = Date.now();

    // Якщо затиснута кнопка миші (перетягування карти / елементів)
    if (isMouseDownRef.current && (currentMode === 'direct' || currentMode === 'drag')) {
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
  }, [ws, getImgCoords, isFullscreen, sendInteraction]);

  // ─── Mouse Up ───────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const currentMode = modeRef.current;
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    const buttonName = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

    if (isMouseDownRef.current && (currentMode === 'direct' || currentMode === 'drag')) {
      isMouseDownRef.current = false;
      if (coords) {
        sendInteraction('mouseup', { ...coords, button: buttonName });
      }
    }
  }, [ws, getImgCoords, isFullscreen, sendInteraction]);

  // ─── Mouse Click ────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const currentMode = modeRef.current;
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;

    const colors: Record<Mode, string> = {
      direct: 'border-emerald-400', click: 'border-teal-400',
      drag: 'border-cyan-400', hover: 'border-amber-400',
      pick: 'border-indigo-400', ctrl_click: 'border-purple-400',
      shift_click: 'border-fuchsia-400',
    };
    triggerRipple(e, colors[currentMode] || 'border-emerald-400');

    if (currentMode === 'pick') {
      const isSmart = e.shiftKey ? window.confirm('Використати СМАРТ селектор? (OK = Смарт, Скасувати = Стандарт)') : false;
      ws.send(JSON.stringify({
        type: 'PICK_SELECTOR_BY_COORDS',
        action: 'pick',
        ...coords, nodeId, pickType, isSmart,
      }));
      return;
    }

    if (currentMode === 'direct') {
      return;
    }

    sendInteraction(currentMode, coords);

    if (isRecording) {
      ws.send(JSON.stringify({ type: 'RECORD_NODE', ...coords }));
    }

    if (currentMode === 'ctrl_click' || currentMode === 'shift_click') {
      setTimeout(() => setMode('direct'), 150);
    }
  }, [ws, nodeId, pickType, isRecording, getImgCoords, isFullscreen, triggerRipple, sendInteraction]);

  // ─── Right Click (Context Menu) ─────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!ws) return;
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;
    triggerRipple(e, 'border-rose-400');
    sendInteraction('right_click', coords);
  }, [ws, getImgCoords, isFullscreen, triggerRipple, sendInteraction]);

  // ─── Double Click ───────────────────────────────────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;
    triggerRipple(e, 'border-blue-400');
    sendInteraction('double_click', coords);
  }, [ws, getImgCoords, isFullscreen, triggerRipple, sendInteraction]);

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
            <button
              onClick={() => {
                setIsFullscreen(false);
                if (!devToolsUrl) ws?.send(JSON.stringify({ type: 'OPEN_DEVTOOLS' }));
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/90 hover:bg-blue-600 rounded-lg text-[10px] font-black text-white uppercase"
              title="DevTools"
            >
              <Code size={13} />
              <span className="hidden sm:inline">DevTools</span>
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

        {/* Кадр на весь екран */}
        <div className="flex-1 overflow-auto relative bg-black flex items-center justify-center">
          {renderFrame(fullscreenContainerRef, true)}
        </div>

        {/* Нижня панель керування */}
        {renderControlBar(true)}
      </div>
    );
  }

  // ─── 2. DevTools модалка ────────────────────────────────────────────────────
  if (devToolsUrl) {
    return (
      <div 
        className="fixed inset-0 z-[var(--z-stream-picker)] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200" 
        onClick={onClose}
      >
        <div 
          className="relative w-full max-w-6xl h-[90vh] bg-[#1e1e1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/70 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-blue-400" />
              <span className="font-bold text-xs uppercase tracking-wider text-white">Код елемента (Chrome DevTools)</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDevToolsUrl(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
              >
                <Play size={12} fill="currentColor" />
                <span>Повернутися до трансляції</span>
              </button>

              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full relative bg-[#121827] flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl backdrop-blur-md">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Code size={28} />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chrome DevTools Інспектор</h3>
              <p className="text-[11px] text-white/60">
                Інспектування DOM-дерева, стилів та мережі працює у безпечному вікні інспектора Chromium.
              </p>
              <button
                onClick={() => window.open(devToolsUrl, '_blank', 'width=1200,height=800')}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Code size={14} />
                <span>Відкрити вікно DevTools</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. Звичайний режим трансляції ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[var(--z-stream-picker)] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative w-full max-w-5xl flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl flex transition-all duration-300 max-h-[95vh]"
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

              {/* DevTools */}
              <button
                onClick={() => {
                  if (devToolsUrl) setDevToolsUrl(null);
                  else ws?.send(JSON.stringify({ type: 'OPEN_DEVTOOLS' }));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm bg-muted text-muted-foreground hover:bg-muted/80"
                title="Відкрити Chrome DevTools"
              >
                <Code size={12} />
                <span>DevTools</span>
              </button>
            </div>
          </div>

          {/* Кадр трансляції */}
          <div ref={scrollRef} className="relative flex-1 bg-black/40 overflow-auto touch-none backdrop-blur-sm min-h-[300px] max-h-[60vh] flex items-center justify-center">
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

          {/* Нижня панель керування */}
          {renderControlBar(false)}
        </div>
      </div>
    </div>
  );
};

export default StreamPicker;
