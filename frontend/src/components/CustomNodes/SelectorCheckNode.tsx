// Нода перевірки наявності CSS-елемента на сторінці
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Search, MousePointer, Check, X, Camera } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const SelectorCheckNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;

  return (
    <BaseNode id={id} data={data} icon={<Search size={16} />} title="Перевірка" bgColor="bg-orange-400" type="selectorCheckNode">
      {/* Вхід — ЗАВЖДИ в DOM */}
      <Handle type="target" position={Position.Left}
        style={getHandleStyle('#fb923c', '20px', mini)} className="!left-[-6px]" />

      {/* Виходи — ЗАВЖДИ в DOM */}
      <Handle type="source" position={Position.Right} id="exists"
        style={getHandleStyle('#22c55e', mini ? '50%' : '35%', mini)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_exists"
        style={getHandleStyle('#ef4444', mini ? '50%' : '65%', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <MousePointer size={12} /> Елемент для пошуку
            </label>
            <div className="flex gap-1">
              <Input
                value={data.selector || ''}
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder=".some-selector"
                className="h-7 text-[10px] font-mono border-border bg-muted text-muted-foreground"
              />
              {/* Нові уніфіковані кнопки вибору */}
              <button
                onClick={() => data.onPickElement?.(id)}
                className="p-1.5 bg-orange-400/20 hover:bg-orange-400/40 text-orange-400 rounded-md transition-colors shrink-0"
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

          {/* Підписи портів */}
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase">
              <Check size={10} /> Є на сторінці
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

export default SelectorCheckNode;

