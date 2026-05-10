import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Repeat, Target, Filter, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const CHILD_TYPES = [
  { value: 'img', label: 'Картинки (img)' },
  { value: 'button', label: 'Кнопки (button)' },
  { value: 'div', label: 'Блоки (div)' },
  { value: 'span', label: 'Тексти (span)' },
  { value: '*', label: 'Всі елементи' },
  { value: 'custom', label: 'Свій селектор...' },
];

const ValueLoopNode = memo(({ id, data }: any) => {
  const childType = data.childType || 'img';
  const childCustom = data.childCustomSelector || '';
  const minValue = data.minValue ?? 0;

  return (
    <BaseNode id={id} data={data} icon={<Repeat size={16} />} title="Цикл Кліків" bgColor="bg-fuchsia-500" type="valueLoopNode" width="w-72">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#d946ef', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} id="done" style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="fail" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Target size={12} /> Батьківський блок
            </label>
            <div className="flex gap-2">
              <Input 
                value={data.selector || ''} 
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder="Оберіть через 🎯..." 
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground flex-1" 
              />
              <Button size="sm" className="h-7 w-7 p-0 bg-fuchsia-500 hover:bg-fuchsia-600 text-white shrink-0" onClick={() => data.onPickElement && data.onPickElement(id)}>
                <Target size={14} />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Filter size={12} /> Тип дочірніх елементів
            </label>
            <select 
              value={childType} 
              onChange={(e) => data.onDataChange(id, { childType: e.target.value })} 
              className="w-full h-8 text-[11px] bg-muted border border-border rounded-md px-2 cursor-pointer text-foreground font-medium outline-none focus:ring-1 ring-fuchsia-500"
            >
              {CHILD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {childType === 'custom' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">CSS селектор</label>
              <Input value={childCustom} onChange={(e) => data.onDataChange(id, { childCustomSelector: e.target.value })} placeholder="img.crop-icon" className="h-7 text-[10px] border-border bg-muted text-muted-foreground" />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Мін. число поруч (≥)</label>
            <Input type="number" value={minValue} onChange={(e) => data.onDataChange(id, { minValue: parseInt(e.target.value) || 0 })} className="h-7 text-[10px] border-border bg-muted text-muted-foreground w-full font-mono" />
          </div>

          {data.loopResult && (
            <div className="bg-muted/50 rounded p-2 border border-border text-[10px] flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓ {data.loopResult.clicked || 0}</span>
              <span className="text-muted-foreground">/ {data.loopResult.total || 0} знайдено</span>
            </div>
          )}

          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
             <div className="flex items-center gap-1 text-[8px] font-bold text-green-500 uppercase tracking-tighter">
                <Check size={10} /> Готово
             </div>
             <div className="flex items-center gap-1 text-[8px] font-bold text-red-500 uppercase tracking-tighter">
                Помилка <X size={10} />
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default ValueLoopNode;
