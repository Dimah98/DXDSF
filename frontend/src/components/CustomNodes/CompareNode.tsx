import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Scale, ArrowRightLeft } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import BaseNode, { getHandleStyle } from './BaseNode';

const CompareNode = memo(({ id, data }: any) => {
  const operators = [
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '==', value: '==' },
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
    { label: '!=', value: '!=' },
  ];

  return (
    <BaseNode id={id} data={data} icon={<Scale size={16} />} title="Порівняння" bgColor="bg-indigo-600" type="compareNode" width="w-52">
      {/* Входи даних */}
      <Handle type="target" position={Position.Left} id="valA" style={getHandleStyle('#6366f1', data.miniCollapsed ? '20px' : '65px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="valB" style={getHandleStyle('#818cf8', data.miniCollapsed ? '20px' : '115px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Вхід запуску */}
      <Handle type="target" position={Position.Left} id="execute" style={getHandleStyle('#4f46e5', data.miniCollapsed ? '20px' : '40px', data.miniCollapsed)} className="!left-[-6px]" />

      {/* Виходи */}
      <Handle type="source" position={Position.Right} id="true" style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '60px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="false" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '95px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          {/* Значення A */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-1">
               <span>Значення A</span>
               <span className="italic opacity-50">← Порт A</span>
            </div>
            <Input 
              type="number" 
              value={data.valA || 0} 
              onChange={(e) => data.onDataChange(id, { valA: parseFloat(e.target.value) || 0 })} 
              className="h-7 text-xs border-border bg-muted text-foreground" 
            />
          </div>

          {/* Оператор */}
          <div className="flex justify-center">
            <Select 
              value={data.operator || '>'} 
              onValueChange={(val) => data.onDataChange(id, { operator: val })}
            >
              <SelectTrigger className="h-7 w-20 text-xs border-border bg-muted font-bold text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map(op => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Значення B */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-1">
               <span>Значення B</span>
               <span className="italic opacity-50">← Порт B</span>
            </div>
            <Input 
              type="number" 
              value={data.valB || 0} 
              onChange={(e) => data.onDataChange(id, { valB: parseFloat(e.target.value) || 0 })} 
              className="h-7 text-xs border-border bg-muted text-foreground" 
            />
          </div>

          <div className="pt-1 border-t border-border flex items-center justify-center gap-2">
             <ArrowRightLeft size={10} className="text-indigo-400 opacity-50" />
             <span className="text-[9px] text-muted-foreground italic">Гілки: True (Зел), False (Чер)</span>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CompareNode;
