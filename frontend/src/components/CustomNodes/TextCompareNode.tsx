import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Type, ArrowRightLeft } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import BaseNode, { getHandleStyle } from './BaseNode';

const TextCompareNode = memo(({ id, data }: any) => {
  const operators = [
    { label: 'Дорівнює', value: 'equals' },
    { label: 'Не дорівнює', value: 'not_equals' },
    { label: 'Містить', value: 'contains' },
    { label: 'Не містить', value: 'not_contains' },
    { label: 'Починається з', value: 'starts_with' },
    { label: 'Закінчується на', value: 'ends_with' },
    { label: 'Регулярний вираз', value: 'matches' },
  ];

  return (
    <BaseNode id={id} data={data} icon={<Type size={16} />} title="Порівняння тексту" bgColor="bg-pink-600" type="textCompareNode" width="w-56">
      {/* Входи даних */}
      <Handle type="target" position={Position.Left} id="textA" style={getHandleStyle('#f472b6', data.miniCollapsed ? '20px' : '65px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="textB" style={getHandleStyle('#fbcfe8', data.miniCollapsed ? '20px' : '115px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Вхід запуску */}
      <Handle type="target" position={Position.Left} id="execute" style={getHandleStyle('#ec4899', data.miniCollapsed ? '20px' : '40px', data.miniCollapsed)} className="!left-[-6px]" />

      {/* Виходи */}
      <Handle type="source" position={Position.Right} id="true" style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '60px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="false" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '95px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          {/* Змінна A */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-1">
               <span>Текст A</span>
               <span className="italic opacity-50">← Порт A</span>
            </div>
            <Input 
              placeholder="Змінна або текст..."
              value={data.varA || ''} 
              onChange={(e) => data.onDataChange(id, { varA: e.target.value })} 
              className="h-7 text-xs border-border bg-muted text-foreground" 
            />
          </div>

          {/* Оператор */}
          <div className="space-y-1">
            <div className="text-[8px] font-bold text-muted-foreground uppercase px-1">Оператор</div>
            <Select 
              value={data.operator || 'equals'} 
              onValueChange={(val) => data.onDataChange(id, { operator: val })}
            >
              <SelectTrigger className="h-7 w-full text-xs border-border bg-muted text-foreground font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map(op => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Текст B */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-1">
               <span>Текст B</span>
               <span className="italic opacity-50">← Порт B</span>
            </div>
            <Input 
              placeholder="Текст для порівняння..."
              value={data.valB || ''} 
              onChange={(e) => data.onDataChange(id, { valB: e.target.value })} 
              className="h-7 text-xs border-border bg-muted text-foreground" 
            />
          </div>

          <div className="pt-1 border-t border-border flex items-center justify-center gap-2">
             <ArrowRightLeft size={10} className="text-pink-400 opacity-50" />
             <span className="text-[9px] text-muted-foreground italic">Гілки: True (Зел), False (Чер)</span>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default TextCompareNode;
