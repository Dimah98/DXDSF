// Нода пошуку дочірнього елемента всередині батьківського блоку
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Search, Check, X, Camera, MousePointer } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const SearchInNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;

  return (
    <BaseNode id={id} data={data} icon={<Search size={16} />} title="Пошук у блоці" bgColor="bg-indigo-500" type="searchInNode">
      {/* Вхід — ЗАВЖДИ в DOM */}
      <Handle type="target" position={Position.Left}
        style={getHandleStyle('#6366f1', '20px', mini)} className="!left-[-6px]" />
      {/* Виходи — ЗАВЖДИ в DOM */}
      <Handle type="source" position={Position.Right} id="found"
        style={getHandleStyle('#10b981', mini ? '50%' : '35%', mini)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_found"
        style={getHandleStyle('#ef4444', mini ? '50%' : '65%', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Батьківський селектор */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Батьківський блок
            </label>
            <div className="flex gap-1">
              <Input
                value={data.parentSelector || ''}
                onChange={(e) => data.onDataChange(id, { parentSelector: e.target.value })}
                placeholder=".container-class"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground"
              />
              {/* Кнопки вибору — MousePointer + Camera (однаково як в ActionNode) */}
              <button
                onClick={() => data.onPickElement?.(id, 'parent')}
                className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-md transition-colors shrink-0"
                title="Вибрати у браузері"
              >
                <MousePointer size={13} />
              </button>
              <button
                onClick={() => data.onPickElement?.(id, 'parent')}
                className="p-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-md transition-colors shrink-0"
                title="Live View"
              >
                <Camera size={13} />
              </button>
            </div>
          </div>

          {/* Дочірній селектор */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Шукати всередині
            </label>
            <div className="flex gap-1">
              <Input
                value={data.childSelector || ''}
                onChange={(e) => data.onDataChange(id, { childSelector: e.target.value })}
                placeholder=".child-element"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground"
              />
              <button
                onClick={() => data.onPickElement?.(id, 'child')}
                className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-md transition-colors shrink-0"
                title="Вибрати у браузері"
              >
                <MousePointer size={13} />
              </button>
              <button
                onClick={() => data.onPickElement?.(id, 'child')}
                className="p-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-md transition-colors shrink-0"
                title="Live View"
              >
                <Camera size={13} />
              </button>
            </div>
          </div>

          {/* Підписи портів */}
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase">
              <Check size={10} /> Знайдено
            </div>
            <div className="flex items-center gap-1 text-[9px] font-bold text-red-500 uppercase">
              Немає <X size={10} />
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default SearchInNode;

