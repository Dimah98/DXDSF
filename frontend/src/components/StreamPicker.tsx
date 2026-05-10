import React, { useState, useEffect, useRef } from 'react';
import { X, MousePointer, Loader2, Camera } from 'lucide-react';

interface StreamPickerProps {
  onClose: () => void;
  ws: WebSocket | null;
  nodeId: string;
  pickType: string;
}

const StreamPicker: React.FC<StreamPickerProps> = ({ onClose, ws, nodeId, pickType }) => {
  const [frame, setFrame] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'pick' | 'click' | 'hover' | 'ctrl_click' | 'shift_click'>('click'); 
  const [isRecording, setIsRecording] = useState(false);
  const [zoom, setZoom] = useState(1); // 1 = 100%
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStartCenter, setTouchStartCenter] = useState<{x: number, y: number} | null>(null);
  const [startScroll, setStartScroll] = useState<{left: number, top: number} | null>(null);
  const [startZoom, setStartZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const centerX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
      const centerY = (e.touches[0].pageY + e.touches[1].pageY) / 2;

      setTouchStartDist(dist);
      setTouchStartCenter({ x: centerX, y: centerY });
      setStartZoom(zoom);
      
      if (scrollRef.current) {
        setStartScroll({ 
          left: scrollRef.current.scrollLeft, 
          top: scrollRef.current.scrollTop 
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null && touchStartCenter && startScroll) {
      e.preventDefault();
      
      // 1. Zoom logic
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const ratio = dist / touchStartDist;
      setZoom(Math.max(1, Math.min(4, startZoom * ratio)));

      // 2. Pan logic (Two fingers movement)
      const centerX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
      const centerY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
      
      const dx = centerX - touchStartCenter.x;
      const dy = centerY - touchStartCenter.y;
      
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = startScroll.left - dx;
        scrollRef.current.scrollTop = startScroll.top - dy;
      }
    }
  };

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STREAM_FRAME') {
          setFrame(`data:image/jpeg;base64,${data.frame}`);
          setLoading(false);
        }
        if (data.type === 'SELECTOR_INFO_PICKED' && data.nodeId === nodeId) {
          // onClose(); // Не закриваємо автоматично, щоб було як у браузері
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({ type: 'START_STREAM', nodeId }));

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.send(JSON.stringify({ type: 'STOP_STREAM' }));
    };
  }, [ws, nodeId, onClose]);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current || !ws) return;
    
    const img = containerRef.current.querySelector('img');
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;
    
    const x = Math.round(relativeX * img.naturalWidth);
    const y = Math.round(relativeY * img.naturalHeight);
    
    // Колір фідбеку залежно від режиму
    let rippleColor = 'border-primary';
    if (mode === 'click') rippleColor = 'border-green-500';
    if (mode === 'hover') rippleColor = 'border-orange-400';
    if (mode.includes('click') && mode !== 'click') rippleColor = 'border-purple-500';

    const clickRipple = document.createElement('div');
    clickRipple.className = `absolute w-6 h-6 border-2 ${rippleColor} rounded-full animate-ping pointer-events-none z-[300]`;
    clickRipple.style.left = `${e.clientX - rect.left - 12}px`;
    clickRipple.style.top = `${e.clientY - rect.top - 12}px`;
    img.parentElement?.appendChild(clickRipple);
    setTimeout(() => clickRipple.remove(), 800);

    // Надсилаємо команду
    ws.send(JSON.stringify({
      type: mode === 'pick' ? 'PICK_SELECTOR_BY_COORDS' : 'INTERACT_BROWSER',
      action: mode,
      x,
      y,
      nodeId,
      pickType
    }));

    // Якщо увімкнено запис — просимо бекенд створити ноду
    if (isRecording && mode !== 'pick') {
      ws.send(JSON.stringify({ type: 'RECORD_NODE', x, y }));
    }

    // Після Ctrl/Shift кліку автоматично перемикаємо на звичайний клік, 
    // щоб можна було зручно вибрати пункт у меню, що з'явилося.
    if (mode === 'ctrl_click' || mode === 'shift_click') {
      setTimeout(() => setMode('click'), 100);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !ws || mode !== 'pick') return;
    const img = containerRef.current.querySelector('img');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;
    const x = Math.round(relativeX * img.naturalWidth);
    const y = Math.round(relativeY * img.naturalHeight);
    ws.send(JSON.stringify({
      type: 'INTERACT_BROWSER',
      action: 'hover',
      x,
      y
    }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex flex-col border-b border-border bg-muted/30">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-xl text-primary">
                <Camera size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm italic uppercase tracking-tighter">Live Control Center</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
                               <button 
                  onClick={() => setIsRecording(!isRecording)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white' : 'bg-red-600'}`} />
                  {isRecording ? 'Запис...' : 'Запис'}
                </button>
                <div className="w-px h-6 bg-border mx-1" />
                {/* Zoom Controls */}

               <div className="flex items-center bg-background border border-border rounded-lg p-1 mr-2">
                  <button onClick={() => setZoom(Math.max(1, zoom - 0.25))} className="p-1 hover:bg-muted rounded text-xs px-2">-</button>
                  <span className="text-[10px] font-bold min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="p-1 hover:bg-muted rounded text-xs px-2">+</button>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5 p-4 pt-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  ws?.send(JSON.stringify({ type: 'INTERACT_BROWSER', action: 'esc', x: 0, y: 0 }));
                }}
                className="px-4 py-2 rounded text-[10px] font-black uppercase bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all flex items-center gap-1"
              >
                ⌨️ Esc
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('pick');
                  ws?.send(JSON.stringify({ type: 'ACTIVATE_PICKER', nodeId, pickType }));
                }}
                className="px-4 py-2 rounded text-[10px] font-bold uppercase bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-1 active:scale-95"
              >
                🎯 Ціль
              </button>
              <div className="w-[1px] h-6 bg-border mx-1 self-center" />
             <button 
               onClick={() => setMode('hover')}
               className={`px-4 py-2 rounded text-[10px] font-bold uppercase transition-all ${mode === 'hover' ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-muted text-muted-foreground'}`}
             >
               🖐️ Навестися
             </button>
             <button 
               onClick={() => setMode('click')}
               className={`px-4 py-2 rounded text-[10px] font-bold uppercase transition-all ${mode === 'click' ? 'bg-green-600 text-white shadow-lg scale-105' : 'bg-muted text-muted-foreground'}`}
             >
               🖱️ Клік
             </button>
             <button 
               onClick={() => setMode('ctrl_click')}
               className={`px-4 py-2 rounded text-[10px] font-bold uppercase transition-all ${mode === 'ctrl_click' ? 'bg-purple-600 text-white shadow-lg scale-105' : 'bg-muted text-muted-foreground'}`}
             >
               ⌨️ Ctrl+Клік
             </button>
             <button 
               onClick={() => setMode('shift_click')}
               className={`px-4 py-2 rounded text-[10px] font-bold uppercase transition-all ${mode === 'shift_click' ? 'bg-cyan-600 text-white shadow-lg scale-105' : 'bg-muted text-muted-foreground'}`}
             >
               ⌨️ Shift+Клік
             </button>
          </div>
        </div>

        {/* Content */}
        <div 
          ref={scrollRef}
          className="relative flex-1 bg-black overflow-auto scrollbar-thin scrollbar-thumb-primary/20 touch-none"
        >
          <div 
            className="min-h-full min-w-full flex items-center justify-center p-4"
            style={{ 
              width: zoom > 1 ? `${zoom * 100}%` : '100%',
              height: zoom > 1 ? 'auto' : '100%'
            }}
          >
            {loading && (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 size={40} className="animate-spin text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest">Підключення до трансляції...</span>
              </div>
            )}
            
            {frame && (
              <div 
                ref={containerRef}
                className="relative cursor-crosshair group touch-auto"
                style={{ width: '100%' }}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => setTouchStartDist(null)}
              >
                <img 
                  src={frame} 
                  alt="Stream" 
                  className="w-full h-auto block select-none shadow-2xl rounded-sm"
                  draggable={false}
                  style={{ imageRendering: zoom > 1.5 ? 'pixelated' : 'auto' }}
                />
                <div className="absolute inset-0 border border-white/10 group-hover:border-primary/30 transition-colors pointer-events-none" />
                
                {/* Overlay info */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                   <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] text-white font-bold border border-white/10 flex items-center gap-2">
                      <MousePointer size={12} className="text-primary" />
                      <span>{zoom > 1 ? `Zoom: ${Math.round(zoom * 100)}%` : 'Клікніть для вибору'}</span>
                   </div>
                   <div className="px-3 py-1 bg-primary/80 backdrop-blur-md rounded-full text-[10px] text-white font-bold border border-white/20 animate-pulse">
                      LIVE
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamPicker;
