// Нода-сканер: зчитує дані з елемента браузера (координати, текст, число, дочірні, картинки)
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Scan, MapPin, Type, Hash, Layers, Image as ImageIcon, ChevronRight, Camera, MousePointer } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Вихідні порти з їх позиціями (відносно верху ноди, включно з заголовком)
// Заголовок ≈ 32px + padding; порти рівномірно розподілені через контент ~180px
const OUT_PORTS = [
  { id: 'coords',   color: '#3b82f6', label: 'XY',       top: '72px'  },
  { id: 'text',     color: '#14b8a6', label: 'Текст',    top: '102px' },
  { id: 'num',      color: '#f59e0b', label: 'Число',    top: '132px' },
  { id: 'children', color: '#a855f7', label: 'Дочірні',  top: '162px' },
  { id: 'images',   color: '#ec4899', label: 'Фото',     top: '192px' },
  { id: 'next',     color: '#64748b', label: 'Далі',     top: '230px' },
  { id: 'fail',     color: '#ef4444', label: 'Помилка',  top: '255px' },
];

const InfoNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;

  return (
    <BaseNode id={id} data={data} icon={<Scan size={16} />} title="Сканер" bgColor="bg-teal-500" type="infoNode" width="w-64">
      {/* Вхід */}
      <Handle type="target" position={Position.Left}
        style={getHandleStyle('#14b8a6', '20px', mini)} className="!left-[-6px]" />

      {/* Всі виходи — ЗАВЖДИ в DOM */}
      {OUT_PORTS.map(p => (
        <Handle
          key={p.id}
          type="source"
          position={Position.Right}
          id={p.id}
          style={getHandleStyle(p.color, mini ? '50%' : p.top, mini)}
          className="!right-[-6px]"
        />
      ))}

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Поле вибору елемента */}
          <div className="flex gap-1">
            <Input
              value={data.selector || ''}
              onChange={(e) => data.onDataChange?.(id, { selector: e.target.value })}
              placeholder="CSS селектор..."
              className="h-7 text-[10px] border-border bg-muted text-muted-foreground"
            />
            <button
              onClick={() => data.onPickElement?.(id)}
              className="p-1.5 bg-teal-500/20 hover:bg-teal-500/40 text-teal-400 rounded-md transition-colors shrink-0"
              title="Вибрати у браузері"
            >
              <MousePointer size={13} />
            </button>
            <button
              onClick={() => data.onPickElement?.(id)}
              className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-md transition-colors shrink-0"
              title="Live View"
            >
              <Camera size={13} />
            </button>
          </div>

          {/* Таблиця результатів з підписами портів */}
          <div className="bg-muted/40 rounded-lg border border-border overflow-hidden">
            {[
              { icon: MapPin,    color: 'text-blue-400',   label: 'Координати', value: data.lastCoords,         port: OUT_PORTS[0] },
              { icon: Type,      color: 'text-teal-400',   label: 'Текст',       value: data.lastText,           port: OUT_PORTS[1] },
              { icon: Hash,      color: 'text-amber-400',  label: 'Число',       value: data.lastNum,            port: OUT_PORTS[2] },
              { icon: Layers,    color: 'text-purple-400', label: 'Дочірні',     value: data.lastChildrenCount,  port: OUT_PORTS[3] },
              { icon: ImageIcon, color: 'text-pink-400',   label: 'Картинки',    value: data.lastImagesCount,    port: OUT_PORTS[4] },
            ].map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50 last:border-0"
              >
                {/* Кольорова крапка порту */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: row.port.color }}
                />
                <row.icon size={11} className={`${row.color} shrink-0`} />
                <span className="text-[10px] text-muted-foreground w-16 shrink-0">{row.label}:</span>
                <span className="text-[10px] font-mono text-foreground truncate flex-1">
                  {row.value || '—'}
                </span>
              </div>
            ))}
          </div>

          {/* Знайдені імена (картинки / дочірні) */}
          {(data.imageNames?.length > 0 || data.childrenNames?.length > 0) && (
            <div className="space-y-2 max-h-28 overflow-y-auto custom-scrollbar">
              {data.imageNames?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-pink-500 uppercase flex items-center gap-1">
                    <ImageIcon size={9} /> Картинки ({data.imageNames.length})
                  </div>
                  {data.imageNames.map((name: string, i: number) => (
                    <div key={i} className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <ChevronRight size={8} className="shrink-0" /> {name}
                    </div>
                  ))}
                </div>
              )}
              {data.childrenNames?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-purple-500 uppercase flex items-center gap-1">
                    <Layers size={9} /> Дочірні ({data.childrenNames.length})
                  </div>
                  {data.childrenNames.map((item: any, i: number) => (
                    <div key={i} className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <ChevronRight size={8} className="shrink-0" /> {item.name}
                      <span className="opacity-40 italic">({item.selector})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Підпис останнього порту */}
          <div className="flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground border-t border-border pt-1">
            <div className="w-2 h-2 rounded-full shrink-0 bg-slate-500" />
            Далі (після виконання)
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[9px] text-red-400 mt-1 pb-1">
            <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
            Не знайдено (Помилка)
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default InfoNode;

