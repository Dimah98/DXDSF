// Нода скріншоту: зберігає скріншот сторінки або елемента
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera, Image as ImageIcon, MousePointer } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const ScreenshotNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const mode = data.mode || 'fullPage';

  return (
    <BaseNode id={id} data={data} icon={<Camera size={16} />} title="Скріншот" bgColor="bg-pink-500" type="screenshotNode" width="w-64">
      {/* Вхід */}
      <Handle type="target" position={Position.Left}
        style={getHandleStyle('#ec4899', '20px', mini)} className="!left-[-6px]" />

      {/* Вихід */}
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        style={getHandleStyle('#64748b', mini ? '50%' : '72px', mini)}
        className="!right-[-6px]"
      />

      {/* Вихід помилки */}
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={getHandleStyle('#ef4444', mini ? '50%' : '102px', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Режим скріншоту */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
              <Camera size={11} /> Режим
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => data.onDataChange?.(id, { mode: 'fullPage' })}
                className={`flex-1 px-2 py-1.5 text-[10px] rounded-md transition-colors ${
                  mode === 'fullPage'
                    ? 'bg-pink-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Вся сторінка
              </button>
              <button
                onClick={() => data.onDataChange?.(id, { mode: 'selector' })}
                className={`flex-1 px-2 py-1.5 text-[10px] rounded-md transition-colors ${
                  mode === 'selector'
                    ? 'bg-pink-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Елемент
              </button>
            </div>
          </div>

          {/* Селектор (тільки для режиму елемента) */}
          {mode === 'selector' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <MousePointer size={11} /> Селектор елемента
              </label>
              <div className="flex gap-1">
                <Input
                  value={data.selector || ''}
                  onChange={(e) => data.onDataChange?.(id, { selector: e.target.value })}
                  placeholder="CSS селектор..."
                  className="h-7 text-[10px] border-border bg-muted text-muted-foreground flex-1"
                />
                <button
                  onClick={() => data.onPickElement?.(id)}
                  className="p-1.5 bg-pink-500/20 hover:bg-pink-500/40 text-pink-400 rounded-md transition-colors shrink-0"
                  title="Вибрати у браузері"
                >
                  <MousePointer size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Назва файлу (опціонально) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
              <ImageIcon size={11} /> Назва файлу (опціонально)
            </label>
            <Input
              value={data.imageName || ''}
              onChange={(e) => data.onDataChange?.(id, { imageName: e.target.value })}
              placeholder="screenshot_1234567890.png"
              className="h-7 text-[10px] border-border bg-muted text-muted-foreground"
            />
            <p className="text-[9px] text-muted-foreground italic">
              Якщо не вказано — автогенерація за часом
            </p>
          </div>

          {/* Підписи портів */}
          <div className="flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground border-t border-border pt-2">
            <div className="w-2 h-2 rounded-full shrink-0 bg-slate-500" />
            Успішно
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[9px] text-red-400 mt-1 pb-1">
            <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
            Помилка
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default ScreenshotNode;
