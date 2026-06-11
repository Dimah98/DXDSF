// Нода-сканер інвентаря: витягує зображення + числа з елементів сторінки
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Package, MousePointer, Camera } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Вихідні порти з їх позиціями (відносно верху ноди, включно з заголовком)
const OUT_PORTS = [
  { id: 'success', color: '#22c55e', label: 'Успіх',   top: '180px' },
  { id: 'error',   color: '#ef4444', label: 'Помилка', top: '205px' },
];

const InventoryScannerNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;

  return (
    <BaseNode id={id} data={data} icon={<Package size={16} />} title="Сканер Інвентаря" bgColor="bg-indigo-500" type="inventoryScannerNode" width="w-72">
      {/* Вхід */}
      <Handle type="target" position={Position.Left}
        style={getHandleStyle('#6366f1', '20px', mini)} className="!left-[-6px]" />

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
          {/* Поле контейнера (опційно) */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-300 uppercase">
              Контейнер (опційно)
              <span className="text-[8px] text-muted-foreground ml-1 normal-case">— обмежити пошук</span>
            </label>
            <Input
              value={data.containerSelector || ''}
              onChange={(e) => data.onDataChange?.(id, { containerSelector: e.target.value })}
              placeholder=".inventory-container"
              className="h-7 text-[10px] border-border bg-muted text-muted-foreground font-mono"
            />
          </div>

          {/* Поле селектора */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-300 uppercase">CSS Селектор елементів</label>
            <div className="flex gap-1">
              <Input
                value={data.selector || ''}
                onChange={(e) => data.onDataChange?.(id, { selector: e.target.value })}
                placeholder=".inventory-item"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground font-mono"
              />
              <button
                onClick={() => data.onPickElement?.(id)}
                className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-md transition-colors shrink-0"
                title="Вибрати у браузері"
              >
                <MousePointer size={13} />
              </button>
              <button
                onClick={() => data.onPickElement?.(id)}
                className="p-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-md transition-colors shrink-0"
                title="Live View"
              >
                <Camera size={13} />
              </button>
            </div>
          </div>

          {/* Режим сканування */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-300 uppercase">Режим</label>
            <div className="flex gap-1">
              <button
                onClick={() => data.onDataChange?.(id, { mode: 'first' })}
                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded transition-all ${
                  data.mode === 'first'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                Перший
              </button>
              <button
                onClick={() => data.onDataChange?.(id, { mode: 'all' })}
                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded transition-all ${
                  data.mode === 'all'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                Всі
              </button>
            </div>
          </div>

          {/* Джерело зображення */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-300 uppercase">Джерело зображення</label>
            <select
              value={data.imageSource || 'auto'}
              onChange={(e) => data.onDataChange?.(id, { imageSource: e.target.value })}
              className="w-full h-7 text-[10px] border border-border bg-muted text-foreground rounded px-2"
            >
              <option value="auto">Авто (src → background)</option>
              <option value="src">Тільки src</option>
              <option value="background">Тільки background</option>
            </select>
          </div>

          {/* Regex для числа (опційно) */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-300 uppercase">Regex числа (опційно)</label>
            <Input
              value={data.numberRegex || ''}
              onChange={(e) => data.onDataChange?.(id, { numberRegex: e.target.value })}
              placeholder="(\d+(?:\.\d+)?)"
              className="h-7 text-[10px] border-border bg-muted text-muted-foreground font-mono"
            />
          </div>

          {/* Статус останнього сканування */}
          {data.status && (
            <div className="bg-muted/40 rounded-lg border border-border p-2">
              <div className="text-[9px] font-bold text-indigo-400 uppercase mb-1">Статус</div>
              <div className="text-[10px] text-foreground">{data.status}</div>
              {data.lastScanCount !== undefined && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Знайдено елементів: <span className="font-bold text-foreground">{data.lastScanCount}</span>
                </div>
              )}
              {data.lastScanTime && (
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  {new Date(data.lastScanTime).toLocaleString('uk-UA')}
                </div>
              )}
            </div>
          )}

          {/* Підписи портів */}
          <div className="space-y-1 border-t border-border pt-2">
            <div className="flex items-center justify-end gap-1.5 text-[9px] text-green-400">
              <div className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
              Успіх (сканування виконано)
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[9px] text-red-400">
              <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
              Помилка (невалідний селектор)
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default InventoryScannerNode;
