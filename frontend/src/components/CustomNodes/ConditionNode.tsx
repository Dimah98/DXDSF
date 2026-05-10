import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { HelpCircle, Check, X, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const ConditionNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<HelpCircle size={16} />} title="Умова" bgColor="bg-orange-500" type="conditionNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#f97316', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Виходи True/False */}
      <Handle type="source" position={Position.Right} id="true" style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="false" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <select 
            value={data.conditionType || 'exists'} 
            onChange={(e) => data.onDataChange(id, { conditionType: e.target.value })} 
            className="w-full h-8 text-xs border rounded bg-muted border-border px-1 outline-none focus:ring-1 ring-orange-500"
          >
            <option value="exists">Селектор існує</option>
            <option value="not_exists">Селектор НЕ існує</option>
            <option value="compare">Порівняння чисел</option>
            <option value="textMatch">Співпадіння тексту</option>
          </select>

          {(data.conditionType === 'exists' || data.conditionType === 'not_exists') && (
            <div className="flex gap-2">
              <Input 
                value={data.selector || ''} 
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder="Селектор..." 
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
              />
              <Button 
                size="sm" 
                className="h-7 w-7 p-0 bg-orange-500 hover:bg-orange-600 text-white" 
                onClick={() => data.onPickElement && data.onPickElement(id)}
              >
                <Target size={14} />
              </Button>
            </div>
          )}

          {data.conditionType === 'compare' && (
             <div className="space-y-2 p-2 bg-muted/50 rounded-md border border-orange-500/10">
                <div className="flex items-center gap-2">
                   <Input value={data.varA} onChange={(e) => data.onDataChange(id, { varA: e.target.value })} placeholder="Змінна A" className="h-6 text-[9px]" />
                   <select value={data.operator} onChange={(e) => data.onDataChange(id, { operator: e.target.value })} className="h-6 text-[9px] bg-background border border-border rounded">
                     <option value=">">&gt;</option>
                     <option value="<">&lt;</option>
                     <option value="==">==</option>
                   </select>
                   <Input value={data.valB} onChange={(e) => data.onDataChange(id, { valB: e.target.value })} placeholder="Значення" className="h-6 text-[9px]" />
                </div>
             </div>
          )}

          <div className="flex justify-between items-center px-1">
             <div className="flex items-center gap-1 text-[9px] font-bold text-green-500 uppercase tracking-tighter">
                <Check size={10} /> ТАК (true)
             </div>
             <div className="flex items-center gap-1 text-[9px] font-bold text-red-500 uppercase tracking-tighter text-right">
                НІ (false) <X size={10} />
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default ConditionNode;
