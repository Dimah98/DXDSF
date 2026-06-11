// Панель трансляції з живого браузера — комфортне керування мишею, клавіатурою і тач-зумом
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, MousePointer, Loader2, ZoomIn, ZoomOut,
  Mouse, Hand, Keyboard,
  Power, Play, ChevronUp, ChevronDown, Code, Maximize2, Minimize2
} from 'lucide-react';

interface StreamPickerProps {
  onClose: () => void;
  ws: WebSocket | null;
  nodeId: string;
  pickType: string;
}

// Режими взаємодії з браузером
type Mode = 'click' | 'hover' | 'pick' | 'ctrl_click' | 'shift_click' | 'scroll';

const MODES: { key: Mode; label: string; icon: React.ReactNode; color: string; hotkey: string }[] = [
  { key: 'click',       label: 'Клік',        icon: <Mouse size={13} />,      color: 'bg-emerald-600',  hotkey: 'C' },
  { key: 'hover',       label: 'Навести',      icon: <Hand size={13} />,       color: 'bg-amber-500',    hotkey: 'H' },

  { key: 'ctrl_click',  label: 'Ctrl+Клік',   icon: <Keyboard size={13} />,   color: 'bg-purple-600',   hotkey: 'D' },
  { key: 'shift_click', label: 'Shift+Клік',  icon: <Keyboard size={13} />,   color: 'bg-fuchsia-600',  hotkey: 'F' },
  { key: 'pick',        label: 'Вибрати',      icon: <MousePointer size={13} />, color: 'bg-indigo-600', hotkey: 'P' },
];

const StreamPicker: React.FC<StreamPickerProps> = ({ onClose, ws, nodeId, pickType }) => {
  const [frame, setFrame] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('click');
  const [isRecording, setIsRecording] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [ripples, setRipples] = useState<{id: number, x: number, y: number, color: string}[]>([]);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [devToolsUrl, setDevToolsUrl] = useState<string | null>(null);
  // Стан повноекранного режиму (відкривається кліком на кадр)
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Touch pinch-to-zoom
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStartCenter, setTouchStartCenter] = useState<{ x: number; y: number } | null>(null);
  const [startScroll, setStartScroll] = useState<{ left: number; top: number } | null>(null);
  const [startZoom, setStartZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null); // ref для fullscreen кадру
  const scrollRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>(mode); // Актуальний режим без stale closure

  // Синхронізуємо ref з state
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ─── Отримуємо кадри трансляції ─────────────────────────────────────────────
  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STREAM_FRAME') {
          setFrame(`data:image/jpeg;base64,${data.frame}`);
          setLoading(false);
          setIsBrowserOpen(true);
        } else if (data.type === 'DEVTOOLS_URL') {
          const isSecure = window.location.protocol === 'https:';
          const wsProtocol = isSecure ? 'wss=' : 'ws=';
          const newUrl = data.url
            .replace('ws=', wsProtocol)
            .replace('localhost:9222', window.location.host);
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
  }, [ws, nodeId]);

  // ─── Клавіатурні скорочення ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Закрити: ESC виходить з fullscreen якщо він відкритий, інакше закриває панель
      if (e.key === 'Escape') {
        if (isFullscreen) { setIsFullscreen(false); return; }
        onClose();
        return;
      }

      // Зум колесом (Ctrl + колесо мишки — стандарт браузера)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Перемикання режиму клавішами
      const keyUpper = e.key.toUpperCase();
      const found = MODES.find(m => m.hotkey === keyUpper);
      if (found) { e.preventDefault(); setMode(found.key); }

      // Zoom +/-
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => Math.min(4, z + 0.25)); }
      if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(1, z - 0.25)); }
      if (e.key === '0') { e.preventDefault(); setZoom(1); }

      // ESC у браузер
      if (e.key === 'F1') {
        e.preventDefault();
        ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'esc', x: 0, y: 0 }));
      }

      // Enter у браузер
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'enter', x: 0, y: 0 }));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [ws, onClose, isFullscreen]);

  // ─── Обчислення координат відносно зображення ───────────────────────────────
  const getImgCoords = useCallback((e: React.MouseEvent | React.Touch, refOverride?: React.RefObject<HTMLDivElement>) => {
    const ref = refOverride || containerRef;
    const img = ref.current?.querySelector('img');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : (e as React.Touch).clientX;
    const clientY = 'clientY' in e ? e.clientY : (e as React.Touch).clientY;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    return {
      x: Math.round(relX * img.naturalWidth),
      y: Math.round(relY * img.naturalHeight),
    };
  }, []);

  // ─── Клік на кадр ────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!ws) return;
    const currentMode = modeRef.current;

    // Знаходимо активний контейнер (fullscreen або звичайний)
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;

    // Вираховуємо координати з активного контейнера
    const coords = getImgCoords(e, activeRef);
    if (!coords) return;

    // Анімація пульсу на місці кліку
    const colors: Record<Mode, string> = {
      click: 'border-emerald-400', hover: 'border-amber-400',
      pick: 'border-indigo-400', ctrl_click: 'border-purple-400',
      shift_click: 'border-fuchsia-400', scroll: 'border-sky-400',
    };
    
    const rect = activeRef.current?.getBoundingClientRect();
    if (rect) {
      const rippleId = Date.now() + Math.random();
      const x = e.clientX - rect.left - 14;
      const y = e.clientY - rect.top - 14;
      
      setRipples(prev => [...prev, { id: rippleId, x, y, color: colors[currentMode] }]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== rippleId));
      }, 700);
    }

    let isSmart = false;
    if (currentMode === 'pick' && e.shiftKey) {
      isSmart = window.confirm('Використати СМАРТ селектор? (OK = Смарт, Скасувати = Стандарт)');
    }

    // Надсилаємо команду
    ws.send(JSON.stringify({
      type: currentMode === 'pick' ? 'PICK_SELECTOR_BY_COORDS' : 'INTERACT_BROWSER',
      action: currentMode,
      ...coords, nodeId, pickType, isSmart,
    }));

    // Запис нод
    if (isRecording && currentMode !== 'pick') {
      ws.send(JSON.stringify({ type: 'RECORD_NODE', ...coords }));
    }

    // Ctrl/Shift клік → повертаємось до звичайного кліку
    if (currentMode === 'ctrl_click' || currentMode === 'shift_click') {
      setTimeout(() => setMode('click'), 150);
    }
  }, [ws, nodeId, pickType, isRecording, getImgCoords, isFullscreen]);

  // ─── Hover з throttle ────────────────────────────────────────────────────────
  const hoverThrottle = useRef<number>(0);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const activeRef = isFullscreen ? fullscreenContainerRef : containerRef;
    const coords = getImgCoords(e, activeRef);
    if (coords) setCursorPos(coords);
    if (!ws || modeRef.current !== 'hover') return;
    const now = Date.now();
    if (now - hoverThrottle.current < 80) return; // ~12fps для hover
    hoverThrottle.current = now;
    if (coords) ws.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'hover', ...coords }));
  }, [ws, getImgCoords, isFullscreen]);

  // ─── Scroll на кадрі → прокрутка у браузері ─────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!ws) return;
    if (e.ctrlKey) {
      // Ctrl + колесо = зум зображення
      e.preventDefault();
      setZoom(z => Math.max(1, Math.min(4, z - e.deltaY * 0.002)));
    } else if (modeRef.current === 'scroll') {
      // Режим прокрутки → надсилаємо у браузер
      const coords = getImgCoords(e as any);
      if (coords) {
        ws.send(JSON.stringify({
          type: 'INTERACT_BROWSER',
          action: 'scroll',
          x: coords.x,
          y: coords.y,
          deltaX: Math.round(e.deltaX),
          deltaY: Math.round(e.deltaY),
        }));
      }
    }
  }, [ws, getImgCoords]);

  // ─── Touch pinch-to-zoom ─────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const dist = Math.hypot(
      e.touches[0].pageX - e.touches[1].pageX,
      e.touches[0].pageY - e.touches[1].pageY,
    );
    setTouchStartDist(dist);
    setTouchStartCenter({ x: (e.touches[0].pageX + e.touches[1].pageX) / 2, y: (e.touches[0].pageY + e.touches[1].pageY) / 2 });
    setStartZoom(zoom);
    if (scrollRef.current) setStartScroll({ left: scrollRef.current.scrollLeft, top: scrollRef.current.scrollTop });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || touchStartDist === null || !touchStartCenter || !startScroll) return;
    e.preventDefault();
    const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    setZoom(Math.max(1, Math.min(4, startZoom * (dist / touchStartDist))));
    const cx = (e.touches[0].pageX + e.touches[1].pageX) / 2;
    const cy = (e.touches[0].pageY + e.touches[1].pageY) / 2;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = startScroll.left - (cx - touchStartCenter.x);
      scrollRef.current.scrollTop = startScroll.top - (cy - touchStartCenter.y);
    }
  };

  // ─── Fullscreen кадр — загальний для основного та повноекранного ─────────────
  const renderFrame = (refToUse: React.RefObject<HTMLDivElement>) => frame && (
    <div
      ref={refToUse}
      className="relative w-full h-full group touch-auto"
      style={{ cursor: mode === 'hover' ? 'crosshair' : mode === 'scroll' ? 'ns-resize' : 'pointer' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCursorPos(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setTouchStartDist(null)}
    >
      <img
        src={frame}
        alt="Browser stream"
        className="w-full h-auto block select-none"
        draggable={false}
        style={{ imageRendering: zoom > 1.5 ? 'pixelated' : 'auto' }}
      />

      {/* Анімації кліку */}
      {ripples.map(r => (
        <div 
          key={r.id} 
          className={`absolute w-7 h-7 border-2 ${r.color} rounded-full animate-ping pointer-events-none z-[300]`} 
          style={{ left: r.x, top: r.y }} 
        />
      ))}

      {/* Координати + статус */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-full text-[10px] text-white/80 font-mono border border-white/10">
          <MousePointer size={10} className="text-primary shrink-0" />
          {cursorPos
            ? <span>X: <strong>{cursorPos.x}</strong> Y: <strong>{cursorPos.y}</strong></span>
            : <span className="opacity-50">наведіть курсор</span>
          }
        </div>
        <div className="flex items-center gap-1.5">
          {(() => {
            const m = MODES.find(m => m.key === mode);
            return m ? (
              <div className={`flex items-center gap-1 px-2.5 py-1 ${m.color}/80 backdrop-blur-md rounded-full text-[10px] text-white font-bold border border-white/20`}>
                {m.icon}
                <span className="hidden sm:inline">{m.label}</span>
              </div>
            ) : null;
          })()}
          <div className="px-2.5 py-1 bg-red-600/80 backdrop-blur-md rounded-full text-[10px] text-white font-black border border-white/20">
            ● LIVE
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Рендер ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Повноекранний оверлей (відкривається кліком на кадр) ─── */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[999999] bg-black flex flex-col animate-in fade-in duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Мінімальна панель керування зверху */}
          <div className="flex items-center gap-2 px-3 py-2 bg-black/80 border-b border-white/10 shrink-0">
            {/* Режими */}
            {MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  mode === m.key ? `${m.color} text-white` : 'bg-white/10 text-white/60 hover:text-white'
                }`}
                title={`${m.label} (${m.hotkey})`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
            <div className="flex-1" />
            {/* Скрол */}
            <button onClick={() => ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'scroll_up', x: 0, y: 0 }))} className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/60 hover:text-white"><ChevronUp size={14}/></button>
            <button onClick={() => ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'scroll_down', x: 0, y: 0 }))} className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/60 hover:text-white"><ChevronDown size={14}/></button>
            <button onClick={() => ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'esc', x: 0, y: 0 }))} className="px-2 py-1 bg-red-600/80 hover:bg-red-600 rounded text-[10px] font-black text-white uppercase">ESC</button>
            {/* Вийти з fullscreen */}
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/70 hover:text-white"
              title="Вийти з повноекранного режиму (Escape)"
            >
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Кадр на весь екран */}
          <div className="flex-1 overflow-auto relative bg-black">
            {renderFrame(fullscreenContainerRef)}
          </div>
        </div>
      )}

      {/* ─── Основне вікно стрімера ─── */}
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200" onClick={onClose}>
        <div 
          className={`relative w-full ${devToolsUrl ? 'max-w-[100vw] h-[100vh] flex-col lg:h-full lg:flex-row' : 'max-w-5xl flex-col'} bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl flex transition-all duration-300 max-h-[95vh]`}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Ліва частина: Трансляція ───────────────────────────────────── */}
          <div className="flex flex-col flex-1 h-full min-w-0">
            <div className="flex flex-col border-b border-white/10 bg-white/5 shrink-0 backdrop-blur-md">

              {/* Рядок 1: заголовок + зум + закрити */}
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
                  {/* Кнопка запису */}
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                      isRecording
                        ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
                    <span>{isRecording ? 'REC...' : 'Запис'}</span>
                  </button>

                  {/* Zoom контрол */}
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setZoom(z => Math.max(1, z - 0.25))}
                      className="px-2 py-1.5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                      title="Зменшити (–)"
                    ><ZoomOut size={13} /></button>
                    <button
                      onClick={() => setZoom(1)}
                      className="px-2 py-1.5 text-[10px] font-bold min-w-[42px] text-center hover:bg-white/10 transition-colors border-x border-white/10 text-white/80"
                      title="Скинути зум (0)"
                    >
                      <span>{Math.round(zoom * 100)}%</span>
                    </button>
                    <button
                      onClick={() => setZoom(z => Math.min(4, z + 0.25))}
                      className="px-2 py-1.5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                      title="Збільшити (+)"
                    ><ZoomIn size={13} /></button>
                  </div>

                  {/* Кнопка fullscreen */}
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                    title="Повноекранний режим"
                  >
                    <Maximize2 size={16} />
                  </button>

                  {/* Close */}
                  <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white" title="Закрити (ESC)">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Рядок 2: кнопки дій */}
              <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">

                {/* ESC у браузер */}
                <button
                  onClick={() => ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'esc', x: 0, y: 0 }))}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-red-600/90 text-white hover:bg-red-600 transition-all shadow-sm"
                  title="Надіслати ESC у браузер (F1)"
                >
                  <span>ESC</span>
                </button>

                <div className="w-px h-5 bg-border mx-0.5" />

                {/* Скрол */}
                <button
                  onClick={() => ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'scroll_up', x: 0, y: 0 }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-slate-600/90 text-white hover:bg-slate-600 transition-all shadow-sm"
                  title="Скрол вгору"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'scroll_down', x: 0, y: 0 }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-slate-600/90 text-white hover:bg-slate-600 transition-all shadow-sm"
                  title="Скрол вниз"
                >
                  <ChevronDown size={12} />
                </button>

                <div className="w-px h-5 bg-border mx-0.5" />

                {/* Режими взаємодії */}
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
                    <span className="hidden sm:inline">{m.label}</span>
                    <kbd className="ml-1 text-[8px] opacity-50 font-mono hidden md:inline">{m.hotkey}</kbd>
                  </button>
                ))}

                <div className="flex-1" />

                {/* Код елемента */}
                <button
                  onClick={() => {
                    if (devToolsUrl) {
                      setDevToolsUrl(null);
                    } else {
                      ws?.send(JSON.stringify({ type: 'OPEN_DEVTOOLS' }));
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${
                    devToolsUrl 
                      ? 'bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-500 ring-offset-1 ring-offset-background' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title="Відкрити Chrome DevTools"
                >
                  <Code size={12} />
                  <span>Код елемента</span>
                </button>
              </div>
            </div>

            {/* ── Кадр трансляції ── */}
            <div
              ref={scrollRef}
              className="relative flex-1 bg-black/40 overflow-auto touch-none backdrop-blur-sm"
              onWheel={handleWheel}
            >
              <div
                className="min-h-full flex items-start justify-center"
                style={{ width: zoom > 1 ? `${zoom * 100}%` : '100%' }}
              >
                {/* Завантаження */}
                {loading && (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground py-20">
                    <Loader2 size={36} className="animate-spin text-primary" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Підключення до трансляції...</span>
                  </div>
                )}

                {/* Кадр — клік на нього відкриває fullscreen */}
                {frame && (
                  <div
                    ref={containerRef}
                    className="relative w-full group touch-auto cursor-zoom-in"
                    onClick={() => setIsFullscreen(true)}
                    onMouseLeave={() => setCursorPos(null)}
                    title="Натисніть для відкриття на повний екран з передачею кліків"
                  >
                    <img
                      src={frame}
                      alt="Browser stream"
                      className="w-full h-auto block select-none"
                      draggable={false}
                      style={{ imageRendering: zoom > 1.5 ? 'pixelated' : 'auto' }}
                    />
                    {/* Підказка при наведенні */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="flex items-center gap-2 px-4 py-2 bg-black/70 rounded-xl text-white text-sm font-bold backdrop-blur-sm">
                        <Maximize2 size={16} />
                        <span>Натисніть для повноекранного режиму</span>
                      </div>
                    </div>
                    {zoom > 1 && (
                      <div className="absolute inset-0 pointer-events-none border border-white/5" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Права/Нижня частина: DevTools ─── */}
          {devToolsUrl && (
            <div className="flex-[0.8] lg:flex-[1.2] border-t lg:border-t-0 lg:border-l border-border min-h-[40vh] lg:min-h-0 bg-white relative">
              <div className="absolute inset-0">
                <iframe 
                  src={devToolsUrl} 
                  className="w-full h-full border-none"
                  title="DevTools"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StreamPicker;
