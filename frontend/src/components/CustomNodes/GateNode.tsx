import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Repeat, Check, X, RotateCcw, Hash } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const GateNode = memo(({ id, data }: any) => {
  const current = data.currentCount || 0;
  const limit = data.limit || 1;

  return (
    <BaseNode id={id} data={data} icon={<Repeat size={16} />} title="Шлюз-Лічильник" bgColor="bg-amber-600" type="gateNode" width="w-52">
      {/* Входи */}
      <Handle type="target" position={Position.Left} id="execute" style={getHandleStyle('#d97706', '40px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="setLimit" style={getHandleStyle('#f59e0b', '80px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Виходи */}
      <Handle type="source" position={Position.Right} id="pass"   style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '40px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="limit"  style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '80px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Hash size={12} /> Ліміт проходів
            </label>
            <Input 
              type="number" 
              value={limit} 
              onChange={(e) => data.onDataChange(id, { limit: parseInt(e.target.value) || 1 })} 
              className="h-8 text-xs bg-muted border-none focus:ring-1 ring-amber-500" 
            />
          </div>

          <div className="bg-black/20 p-2 rounded-lg border border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-[9px] text-muted-foreground uppercase font-bold">Поточний стан</span>
               <span className="text-xl font-black text-amber-500">{current} <span className="text-xs text-muted-foreground opacity-50">/ {limit}</span></span>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0 hover:bg-amber-500/20 text-amber-500"
              onClick={() => data.onDataChange(id, { currentCount: 0 })}
            >
              <RotateCcw size={14} />
            </Button>
          </div>

          <div className="pt-1 border-t border-border flex items-center justify-between text-[8px] font-bold uppercase">
             <div className="flex items-center gap-1 text-green-500">
                <Check size={10} /> Прохід
             </div>
             <div className="flex items-center gap-1 text-red-500">
                Ліміт <X size={10} />
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default GateNode;
