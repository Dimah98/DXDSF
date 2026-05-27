import React, { useEffect, useState, useRef } from 'react';
import { PORT_TOOLTIPS, getDynamicPortTooltip, type PortDescription } from '../portTooltips';
import type { Node } from '@xyflow/react';

interface PortTooltipManagerProps {
  nodes: Node[];
}

export const PortTooltipManager: React.FC<PortTooltipManagerProps> = ({ nodes }) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: PortDescription | null;
  }>({ visible: false, x: 0, y: 0, data: null });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);

  // Оновлюємо реф на актуальні ноди, щоб не перестворювати слухачів
  useEffect(() => {
    if (Array.isArray(nodes)) {
      nodesRef.current = nodes;
    }
  }, [nodes]);

  useEffect(() => {
    let hoverTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      try {
        const target = e.target as HTMLElement;
        
        // Перевіряємо чи елемент є портом (Handle)
        if (target && target.classList && target.classList.contains('react-flow__handle')) {
          const nodeId = target.getAttribute('data-nodeid');
          const handleId = target.getAttribute('data-handleid') || 'default'; // Якщо немає ID, то це дефолтний порт

          if (nodeId && handleId) {
            // Знаходимо тип ноди
            const node = nodesRef.current.find(n => n.id === nodeId);
            if (node) {
              const nodeType = node.type || 'unknown';
              
              // Шукаємо опис порту
              let portData: PortDescription | null = null;
              if (PORT_TOOLTIPS[nodeType] && PORT_TOOLTIPS[nodeType][handleId]) {
                portData = PORT_TOOLTIPS[nodeType][handleId];
              } else {
                portData = getDynamicPortTooltip(nodeType, handleId);
              }

              // Якщо нічого не знайдено, пробуємо дефолтний словник
              if (!portData && PORT_TOOLTIPS['default'] && PORT_TOOLTIPS['default'][handleId]) {
                portData = PORT_TOOLTIPS['default'][handleId];
              }

              if (portData) {
                const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
                const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;

                if (clientX !== undefined && clientY !== undefined) {
                  // Затримка перед показом, щоб не мерехтіло при швидкому русі
                  if (hoverTimeout) clearTimeout(hoverTimeout);
                  
                  setTooltip({
                    visible: true,
                    x: clientX,
                    y: clientY,
                    data: portData
                  });
                  return;
                }
              }
            }
          }
        }

        // Якщо курсор не на Handle або помилка парсингу
        setTooltip(prev => prev.visible ? { visible: false, x: 0, y: 0, data: null } : prev);
      } catch (err) {
        console.error('Tooltip Manager Error:', err);
      }
    };

    const handleMouseLeave = () => {
      setTooltip({ visible: false, x: 0, y: 0, data: null });
    };

    // Використовуємо capture фазу, щоб перехопити подію раніше за React Flow
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('touchmove', handleMouseMove, { capture: true, passive: true });
    document.addEventListener('touchend', handleMouseLeave, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('touchmove', handleMouseMove, true);
      document.removeEventListener('touchend', handleMouseLeave, true);
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  }, []);

  try {
    if (!tooltip.visible || !tooltip.data) return null;

    // Позиціонування з урахуванням країв екрану
    const style: React.CSSProperties = {
      position: 'fixed',
      left: `${tooltip.x + 15}px`,
      top: `${tooltip.y + 15}px`,
      zIndex: 9999,
      pointerEvents: 'none',
    };

    return (
      <div 
        ref={tooltipRef}
        style={style}
        className="bg-zinc-900/95 backdrop-blur-md border border-white/10 shadow-2xl rounded-lg p-3 w-64 text-left animate-in fade-in zoom-in duration-200"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div 
            className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
            style={{ backgroundColor: tooltip.data.color || '#94a3b8' }}
          />
          <h4 className="font-bold text-sm text-white leading-tight">
            {tooltip.data.title || 'Порт'}
          </h4>
        </div>
        
        <div className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">
          {tooltip.data.type || 'Сигнал'}
        </div>
        
        <p className="text-xs text-zinc-300 leading-snug">
          {tooltip.data.desc || ''}
        </p>
      </div>
    );
  } catch (err) {
    console.error('Tooltip Render Error:', err);
    return null;
  }
};
