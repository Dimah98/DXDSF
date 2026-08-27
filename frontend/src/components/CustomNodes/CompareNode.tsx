import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Scale, ArrowRightLeft, ChevronDown } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Компонент вибору змінної (Dropdown)
const VarSelect = ({ value, onChange, variables }: { value: any, onChange: (v: string) => void, variables: string[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="flex gap-1">
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs border-border bg-muted text-foreground flex-1" 
        />
        <button
          onClick={() => setOpen(!open)}
          className="h-7 px-1.5 bg-muted border border-border rounded hover:bg-accent/20 transition-colors text-muted-foreground"
        >
          <ChevronDown size={12} />
        </button>
      </div>
      {open && (
        <div className="absolute top-8 right-0 z-50 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto min-w-[140px] p-1">
          <div className="text-[8px] font-bold text-muted-foreground px-2 py-1 uppercase border-b border-border/50 mb-1">Змінні проекту</div>
          {variables.length === 0 ? (
            <div className="p-2 text-[9px] text-muted-foreground italic">Порожньо</div>
          ) : (
            variables.map(v => (
              <button
                key={v}
                onClick={() => { onChange(v); setOpen(false); }}
                className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-indigo-500 hover:text-white rounded transition-colors ${value === v ? 'bg-indigo-500/20 text-indigo-400 font-bold' : ''}`}
              >
                {v}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const CompareNode = memo(({ id, data }: any) => {
  const mode = data.compareMode || 'number';
  const savedVarNames = data.globalVariables ? Object.keys(data.globalVariables) : [];

  const numericOps = [
    { label: '>', value: '>' }, { label: '<', value: '<' },
    { label: '==', value: '==' }, { label: '>=', value: '>=' },
    { label: '<=', value: '<=' }, { label: '!=', value: '!=' },
    { label: '📅 = сьогодні (з 03:00)', value: 'time_is_today' }, { label: '📅 ≠ сьогодні (з 03:00)', value: 'time_not_today' }
  ];

  const textOps = [
    { label: 'Дорівнює', value: 'equals' }, { label: 'Не дорівнює', value: 'not_equals' },
    { label: 'Містить', value: 'contains' }, { label: 'Не містить', value: 'not_contains' },
    { label: 'Починається з', value: 'starts_with' }, { label: 'Закінчується на', value: 'ends_with' },
    { label: 'Регулярний вираз', value: 'matches' },
  ];

  const operators = mode === 'number' ? numericOps : textOps;

  return (
    <BaseNode id={id} data={data} icon={<Scale size={16} />} title="Порівняння" bgColor="bg-indigo-600" type="compareNode" width="w-64">
      <Handle type="target" position={Position.Left} id="valA" style={getHandleStyle('#6366f1', data.miniCollapsed ? '20px' : '90px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="valB" style={getHandleStyle('#818cf8', data.miniCollapsed ? '20px' : '140px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="execute" style={getHandleStyle('#4f46e5', data.miniCollapsed ? '20px' : '40px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} id="true" style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '60px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="false" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '95px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-4">
          <div className="flex justify-between items-center gap-2 bg-black/20 p-1 rounded-md border border-white/5">
             <button onClick={() => data.onDataChange(id, { compareMode: 'number', operator: '>' })} className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${mode === 'number' ? 'bg-indigo-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>Числа</button>
             <button onClick={() => data.onDataChange(id, { compareMode: 'text', operator: 'equals' })} className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${mode === 'text' ? 'bg-indigo-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>Текст</button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-1"><span>Значення A</span><span className="italic opacity-50">← Порт A</span></div>
            <VarSelect value={data.valA} onChange={(v) => data.onDataChange(id, { valA: v })} variables={savedVarNames} />
          </div>

          <div className="flex justify-center">
            <select 
              value={data.operator || (mode === 'number' ? '>' : 'equals')} 
              onChange={(e) => data.onDataChange(id, { operator: e.target.value })}
              className="h-7 w-full text-xs border-border bg-muted font-bold text-foreground rounded outline-none px-2"
            >
              {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-1"><span>Значення B</span><span className="italic opacity-50">← Порт B</span></div>
            <VarSelect value={data.valB} onChange={(v) => data.onDataChange(id, { valB: v })} variables={savedVarNames} />
          </div>

          <div className="pt-1 border-t border-border/30 flex items-center justify-center gap-2">
             <ArrowRightLeft size={10} className="text-indigo-400 opacity-50" />
             <span className="text-[9px] text-muted-foreground italic text-center">True (Зел), False (Чер)</span>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CompareNode;
