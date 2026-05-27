// Нода дії — клік, hover, прокрутка, та обхід антибот захисту
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { Play, MousePointer2, Move, MousePointer, Camera, Zap } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

// Типи дій з описами
const ACTION_TYPES = [
  { value: 'click',        label: 'Одинарний клік' },
  { value: 'double_click', label: 'Подвійний клік' },
  { value: 'hover',        label: 'Наведення (Hover)' },
  { value: 'scroll',       label: 'Прокрутити до (Scroll)' },
  { value: 'force_click',  label: '⚡ Force Click (обхід капчі)' },
  { value: 'js_click',     label: '💻 JS Click (dispatch event)' },
];

// Підказки для спеціальних режимів
const HINTS: Record<string, string> = {
  force_click: 'Клік з force:true — ігнорує перевірку viewport. Для елементів з CSS 3D-трансформами (perspective, rotateX/Y).',
  js_click:    'JS клік через element.click() — обходить будь-яку антибот перевірку координат.',
};

const ActionNode = memo(({ id, data }: { id: string, data: any }) => {
  // Динамічно вибираємо іконку
  const IconComponent = data.customIcon && (LucideIcons as any)[data.customIcon]
    ? (LucideIcons as any)[data.customIcon]
    : Play;

  const actionType = data.actionType || 'click';
  const isSpecial = actionType === 'force_click' || actionType === 'js_click';

  return (
    <BaseNode id={id} data={data} icon={<IconComponent size={16} />} title={data.label || 'Дія'} bgColor="bg-blue-500" type="actionNode">
      {/* Порти — завжди в DOM */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#3b82f6', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} id="success" style={getHandleStyle('#3b82f6', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="error" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">

          {/* Тип дії */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <MousePointer2 size={12} /> Тип кліку
            </label>
            <select
              value={actionType}
              onChange={(e) => data.onDataChange(id, { actionType: e.target.value })}
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-blue-500 transition-all outline-none"
            >
              {ACTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Попередження для спеціальних режимів */}
            {isSpecial && (
              <div className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-1.5 flex items-start gap-1.5">
                <Zap size={10} className="shrink-0 mt-0.5 text-amber-400" />
                <span>{HINTS[actionType]}</span>
              </div>
            )}
          </div>

          {/* Селектор елемента */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Move size={12} /> Селектор елемента
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                value={data.selector || ''}
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder="img.absolute.w-16"
                className="flex-1 p-2 text-[11px] bg-muted border-none rounded-md focus:ring-1 ring-blue-500 transition-all outline-none font-mono"
              />
              <button
                onClick={() => data.onPickElement(id)}
                className="p-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-md transition-colors"
                title="Вибрати у браузері"
              >
                <MousePointer size={14} />
              </button>
              <button
                onClick={() => data.onPickElement?.(id)}
                className="p-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-md transition-colors"
                title="Live View"
              >
                <Camera size={14} />
              </button>
            </div>
          </div>

          {/* Клікнути всі копії (не для js_click) */}
          {actionType !== 'js_click' && (
            <label className="flex items-center gap-3 p-2 bg-muted/50 rounded-md cursor-pointer group hover:bg-muted transition-colors">
              <input
                type="checkbox"
                checked={data.clickAll || false}
                onChange={(e) => data.onDataChange(id, { clickAll: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-none bg-blue-500/20 text-blue-500 focus:ring-0"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold group-hover:text-blue-400 transition-colors">Клікнути всі копії</span>
                <span className="text-[9px] text-muted-foreground">Наприклад всі кнопки "Зібрати"</span>
              </div>
            </label>
          )}

          <label className="flex items-center gap-3 p-2 bg-muted/50 rounded-md cursor-pointer group hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={data.isUIElement || false}
              onChange={(e) => data.onDataChange(id, { isUIElement: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-none bg-blue-500/20 text-blue-500 focus:ring-0"
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold group-hover:text-blue-400 transition-colors">Елемент інтерфейсу (статика)</span>
              <span className="text-[9px] text-muted-foreground">Не перетягувати карту до краю вікна</span>
            </div>
          </label>
        </div>
      )}
    </BaseNode>
  );
});

export default ActionNode;

