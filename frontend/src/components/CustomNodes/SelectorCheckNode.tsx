import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Search, Target, Check, X, Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const SelectorCheckNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Search size={16} />} title="Перевірка" bgColor="bg-orange-400" type="selectorCheckNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#fb923c', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Виходи Exists/Not Exists */}
      <Handle type="source" position={Position.Right} id="exists"     style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_exists" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Target size={12} /> Елемент для пошуку
            </label>
            <div className="flex gap-2">
              <Input 
                value={data.selector || ''} 
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder=".some-selector" 
                className="h-7 text-[10px] font-mono border-border bg-muted text-muted-foreground" 
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 w-7 p-0 bg-orange-400/20 hover:bg-orange-400/40 text-orange-400 border border-orange-400/30" onClick={() => data.onPickElement && data.onPickElement(id)}>
                  <Target size={14} />
                </Button>
                <Button size="sm" className="h-7 w-7 p-0 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 border border-indigo-500/30" onClick={() => window.dispatchEvent(new CustomEvent('trigger-stream-picker', { detail: { nodeId: id } }))}>
                  <Camera size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
             <div className="flex items-center gap-1 text-[8px] font-bold text-green-500 uppercase tracking-tighter">
                <Check size={10} /> Є
             </div>
             <div className="flex items-center gap-1 text-[8px] font-bold text-red-500 uppercase tracking-tighter">
                Немає <X size={10} />
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default SelectorCheckNode;
