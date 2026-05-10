import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { Play, MousePointer2, Move, MousePointer, Camera } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const ActionNode = memo(({ id, data }: { id: string, data: any }) => {
  // Динамічно вибираємо іконку, якщо customIcon передано, інакше дефолтна Play
  const IconComponent = data.customIcon && (LucideIcons as any)[data.customIcon] 
    ? (LucideIcons as any)[data.customIcon] 
    : Play;

  return (
    <BaseNode id={id} data={data} icon={<IconComponent size={16} />} title={data.label || 'Дія'} bgColor="bg-blue-500" type="actionNode">
      {/* Порти — тепер використовують спільний getHandleStyle */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#3b82f6', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#3b82f6', '20px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <MousePointer2 size={12} /> Тип кліку
            </label>
            <select 
              value={data.actionType || 'click'} 
              onChange={(e) => data.onDataChange(id, { actionType: e.target.value })}
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-blue-500 transition-all outline-none"
            >
              <option value="click">Одинарний клік</option>
              <option value="double_click">Подвійний клік</option>
              <option value="hover">Наведення (Hover)</option>
              <option value="scroll">Прокрутити до (Scroll)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Move size={12} /> Селектор елемента
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={data.selector} 
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder="input[type='submit']"
                className="flex-1 p-2 text-[11px] bg-muted border-none rounded-md focus:ring-1 ring-blue-500 transition-all outline-none font-mono"
              />
              <div className="flex gap-1">
                <button 
                  onClick={() => data.onPickElement(id)}
                  className="p-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-500 rounded-md transition-colors"
                  title="Вибрати у браузері (стандарт)"
                >
                  <MousePointer size={14} />
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('trigger-stream-picker', { detail: { nodeId: id } }))}
                  className="p-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-500 rounded-md transition-colors"
                  title="Live View (Трансляція)"
                >
                  <Camera size={14} />
                </button>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 p-2 bg-muted/50 rounded-md cursor-pointer group hover:bg-muted transition-colors">
            <input 
              type="checkbox" 
              checked={data.clickAll || false} 
              onChange={(e) => data.onDataChange(id, { clickAll: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-none bg-blue-500/20 text-blue-500 focus:ring-0"
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold group-hover:text-blue-500 transition-colors">Клікнути всі копії</span>
              <span className="text-[9px] text-muted-foreground">Наприклад всі кнопки "Зібрати"</span>
            </div>
          </label>
        </div>
      )}
    </BaseNode>
  );
});

export default ActionNode;
