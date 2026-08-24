// Нода пошуку картинки на екрані (за файлом-еталоном)
import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Search, Image as ImageIcon, Check, X, MapPin, MousePointer, Camera } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Хост API — localhost у devmode, відносний шлях у production (ngrok)
const API_HOST =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '';

// Вихідні порти ноди з їх px-позиціями (відносно верху ноди)
// Заголовок ≈ 32px, поля ≈ 70px → перший порт ~52px
const OUT_PORTS = [
  { id: 'found',     color: '#22c55e', label: 'ТАК',         top: '52px'  },
  { id: 'not_found', color: '#ef4444', label: 'НІ',           top: '82px'  },
  { id: 'coords',    color: '#3b82f6', label: 'Координати',   top: '112px' },
  { id: 'count',     color: '#f59e0b', label: 'Кількість',    top: '142px' },
];

const ImageSearchNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const [imageList, setImageList] = useState<string[]>([]);

  // Завантажуємо список файлів з папки images/
  useEffect(() => {
    fetch(`${API_HOST}/api/images`)
      .then(res => res.json())
      .then(setImageList)
      .catch(() => {});
  }, []);

  return (
    <BaseNode id={id} data={data} icon={<Search size={16} />} title="Пошук картинки" bgColor="bg-indigo-500" type="imageSearchNode">
      {/* Вхід — ЗАВЖДИ в DOM */}
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

          {/* Назви файлів з autocomplete (multi-line) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <ImageIcon size={12} /> Назви файлів (кожна з нового рядка)
            </label>
            <div className="relative">
              <textarea
                list={`images-${id}`}
                value={data.imageName || ''}
                onChange={(e) => data.onDataChange(id, { imageName: e.target.value })}
                placeholder="resource.png&#10;item.png&#10;icon.png"
                rows={3}
                className="w-full px-3 py-2 text-[11px] bg-muted border border-border rounded-md focus:ring-1 ring-indigo-500 resize-none"
              />
              <datalist id={`images-${id}`}>
                {imageList.map(img => <option key={img} value={img} />)}
                {imageList.map(img => <option key={img + '-noext'} value={img.split('.')[0]} />)}
              </datalist>
            </div>
          </div>

          {/* Область пошуку (необов'язковий селектор) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">
              Область пошуку
            </label>
            <div className="flex gap-1">
              <Input
                value={data.selector || ''}
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder="Весь екран або селектор"
                className="h-7 text-[10px] font-mono border-border bg-muted text-muted-foreground"
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
                title="Live View (Трансляція)"
              >
                <Camera size={13} />
              </button>
            </div>
          </div>

          {/* Режим пошуку */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">
              Режим пошуку
            </label>
            <select
              value={data.searchMode || 'first'}
              onChange={(e) => data.onDataChange(id, { searchMode: e.target.value })}
              className="w-full h-7 text-[10px] bg-muted border-border rounded-md px-2 focus:ring-1 ring-indigo-500 text-muted-foreground"
            >
              <option value="first">Тільки в першому знайденому</option>
              <option value="all">У всіх знайдених елементах</option>
            </select>
          </div>

          {/* Підписи портів + статус */}
          <div className="pt-1 border-t border-border flex items-center justify-between">
            {/* Ліворуч: підписи портів Так/Ні */}
            <div className="flex items-center gap-3">
              {OUT_PORTS.slice(0, 2).map(p => (
                <div key={p.id} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[9px] font-bold uppercase" style={{ color: p.color }}>
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
            {/* Праворуч: координати і кількість */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-blue-400">
                <MapPin size={10} />
                <span className="text-[10px] font-mono font-bold">{data.receivedValue || '---'}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400 border-l border-border pl-2">
                <span className="text-[10px] font-mono font-bold">#{data.count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default ImageSearchNode;

