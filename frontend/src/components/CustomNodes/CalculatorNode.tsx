// Нода Калькулятор — математичні операції з числами та змінними
import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Calculator, Plus, Trash2, ArrowRight, Play, ChevronDown, Zap } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const OPS = ['+', '-', '*', '/'];

// Компонент випадаючого списку для вибору змінної
const VarDropdown = ({ 
  value, onChange, variables, showCurrentValue = false
}: { 
  value: string, 
  onChange: (v: string) => void, 
  variables: Record<string, any>,
  showCurrentValue?: boolean
}) => {
  const [open, setOpen] = useState(false);
  const varKeys = Object.keys(variables);
  const currentVal = variables[value];
  const hasCurrentVal = value && currentVal !== undefined;

  return (
    <div className="relative flex-1">
      <div className="flex gap-1 h-6 items-center">
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          placeholder="число або назва змінної"
          className="h-6 text-[10px] bg-[#0f172a] border-slate-700 font-mono flex-1 px-1.5" 
        />
        {/* Показуємо поточне значення змінної якщо вибрано існуючу */}
        {showCurrentValue && hasCurrentVal && (
          <span className="text-[9px] text-amber-400 font-bold font-mono whitespace-nowrap bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            = {typeof currentVal === 'number' ? currentVal.toLocaleString('uk-UA') : currentVal}
          </span>
        )}
        {/* Кнопка завжди видима — для вибору з існуючих або ручного вводу */}
        <button
          onClick={() => setOpen(!open)}
          className="h-6 px-1 bg-muted/50 border border-border rounded hover:bg-accent/20 transition-colors text-muted-foreground shrink-0"
        >
          <ChevronDown size={10} />
        </button>
      </div>
      {open && varKeys.length > 0 && (
        <div className="absolute top-7 left-0 z-50 bg-card border border-border rounded shadow-xl max-h-44 overflow-y-auto min-w-[180px] p-1">
          <div className="text-[8px] font-bold text-muted-foreground px-2 py-1 uppercase border-b border-border/50 mb-1">
            Змінні проекту
          </div>
          {varKeys.map(v => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 text-[10px] rounded transition-colors flex items-center justify-between gap-3
                ${value === v ? 'bg-cyan-600/20 text-cyan-400 font-bold' : 'hover:bg-cyan-600 hover:text-white'}`}
            >
              <span className="font-mono">{v}</span>
              <span className="text-[9px] opacity-70 font-mono shrink-0">
                {typeof variables[v] === 'number' ? variables[v].toLocaleString('uk-UA') : variables[v]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Окремий Dropdown для поля "Зберегти в змінну"
const ResultVarDropdown = ({ 
  value, onChange, variables 
}: { 
  value: string, onChange: (v: string) => void, variables: Record<string, any> 
}) => {
  const [open, setOpen] = useState(false);
  const varKeys = Object.keys(variables);
  const currentVal = variables[value];

  return (
    <div className="relative flex-1">
      <div className="flex gap-1 h-5 items-center">
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          placeholder="Зберегти в змінну..."
          className="h-5 text-[9px] bg-emerald-500/5 border-none text-emerald-400 flex-1" 
        />
        {/* Поточне значення вибраної змінної-результату */}
        {value && currentVal !== undefined && (
          <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 rounded border border-emerald-500/20 shrink-0">
            = {typeof currentVal === 'number' ? currentVal.toLocaleString('uk-UA') : currentVal}
          </span>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="h-5 px-1 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/30 transition-colors text-emerald-500 shrink-0"
        >
          <ChevronDown size={10} />
        </button>
      </div>
      {open && (
        <div className="absolute top-6 left-0 z-50 bg-card border border-border rounded shadow-xl max-h-44 overflow-y-auto min-w-[200px] p-1">
          <div className="text-[8px] font-bold text-muted-foreground px-2 py-1 uppercase border-b border-border/50 mb-1">
            Обрати змінну для результату
          </div>
          {varKeys.length === 0 && (
            <div className="px-2 py-2 text-[9px] text-muted-foreground italic">
              Немає змінних. Введіть нову назву вище.
            </div>
          )}
          {varKeys.map(v => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 text-[10px] rounded transition-colors flex items-center justify-between gap-3
                ${value === v ? 'bg-emerald-600/20 text-emerald-400 font-bold' : 'hover:bg-emerald-600 hover:text-white'}`}
            >
              <span className="font-mono">{v}</span>
              <span className="text-[9px] opacity-70 font-mono shrink-0">
                {typeof variables[v] === 'number' ? variables[v].toLocaleString('uk-UA') : variables[v]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CalculatorNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const examples = data.examples || [{ id: 'ex_0', rows: [{ value: '0', op: '+' }], resultVar: '' }];
  const updateNodeInternals = useUpdateNodeInternals();
  // Глобальні змінні як Record для відображення значень
  const globalVars: Record<string, any> = data.globalVariables || {};

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, examples.length, mini, updateNodeInternals]);

  let totalRowsBefore = 0;

  return (
    <BaseNode id={id} data={data} icon={<Calculator size={16} />} title="Калькулятор" bgColor="bg-cyan-600" type="calculatorNode" width="w-80">
      
      {!mini && examples.map((ex: any, exIdx: number) => {
        const startY = 85 + totalRowsBefore * 40 + exIdx * 45;
        const exRows = ex.rows.length;
        
        const fragment = (
          <React.Fragment key={ex.id}>
            {/* Зелений порт запуску (RUN) */}
            <Handle 
              type="target" position={Position.Left} id={`run_${exIdx}`}
              style={getHandleStyle('#22c55e', `${startY - 22}px`, mini)} 
              className="!left-[-6px] border-2 border-white"
            />
            {/* Сині порти для значень кожного рядка */}
            {ex.rows.map((_: any, rowIdx: number) => (
              <Handle 
                key={`${exIdx}_${rowIdx}`}
                type="target" position={Position.Left} id={`val_${exIdx}_${rowIdx}`}
                style={getHandleStyle('#0891b2', `${startY + rowIdx * 32}px`, mini)} 
                className="!left-[-6px]" 
              />
            ))}
            {/* Вихідний порт результату */}
            <Handle 
              type="source" position={Position.Right} id={`out_${exIdx}`}
              style={getHandleStyle('#0891b2', `${startY + (exRows * 32) / 2 - 16}px`, mini)} 
              className="!right-[-6px]" 
            />
          </React.Fragment>
        );
        totalRowsBefore += exRows;
        return fragment;
      })}

      {!mini && (
        <div className="p-3 space-y-4">
          {examples.map((ex: any, exIdx: number) => (
            <div key={ex.id} className="bg-muted/30 rounded-lg border border-border/50 p-2.5 relative group/ex">
              
              {/* Заголовок блоку з кнопкою видалення */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase">
                  <Play size={10} className="fill-emerald-500/20" /> RUN #{exIdx + 1}
                </div>
                <div className="flex items-center gap-2">
                  {/* Прапорець: запуск при отриманні даних через синій вхід */}
                  <label
                    className="flex items-center gap-1 cursor-pointer group/zap"
                    title="Якщо увімкнено — при надходженні значення через синій порт розрахунок запускається автоматично"
                  >
                    {/* Чекбокс прапорця */}
                    <input
                      type="checkbox"
                      checked={ex.triggerOnInput || false} // Стан чекбоксу з даних прикладу
                      onChange={(e) => { // Оновлюємо прапорець конкретного прикладу
                        const next = [...examples];
                        next[exIdx] = { ...next[exIdx], triggerOnInput: e.target.checked };
                        data.onDataChange(id, { examples: next });
                      }}
                      className="w-2.5 h-2.5 rounded border-none bg-cyan-500/20 text-cyan-500 focus:ring-0"
                    />
                    {/* Іконка блискавки — сигналізує про авто-запуск */}
                    <Zap
                      size={9}
                      className={`transition-colors ${ex.triggerOnInput ? 'text-amber-400' : 'text-muted-foreground group-hover/zap:text-amber-400/50'}`}
                    />
                  </label>
                  {/* Кнопка видалення блоку */}
                  <button onClick={() => {
                    const next = [...examples];
                    next.splice(exIdx, 1);
                    data.onDataChange(id, { examples: next });
                  }} className="text-muted-foreground hover:text-rose-400 opacity-0 group-hover/ex:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Рядки з операндами */}
              <div className="space-y-2">
                {ex.rows.map((row: any, rowIdx: number) => (
                  <div key={rowIdx} className="flex gap-1.5 items-center">
                    <VarDropdown
                      value={row.value}
                      onChange={(v) => {
                        const next = [...examples];
                        next[exIdx].rows[rowIdx].value = v;
                        data.onDataChange(id, { examples: next });
                      }}
                      variables={globalVars}
                      showCurrentValue={true}
                    />
                    
                    {rowIdx < ex.rows.length - 1 ? (
                      // Оператор між рядками
                      <select 
                        value={row.op} 
                        onChange={(e) => {
                          const next = [...examples];
                          next[exIdx].rows[rowIdx].op = e.target.value;
                          data.onDataChange(id, { examples: next });
                        }}
                        className="h-6 text-[10px] bg-muted border border-border rounded px-1 w-10 outline-none shrink-0"
                      >
                        {OPS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    ) : (
                      // Кнопка додати рядок (тільки на останньому)
                      <button onClick={() => {
                        const next = [...examples];
                        next[exIdx].rows.push({ value: '0', op: '+' });
                        data.onDataChange(id, { examples: next });
                      }} className="p-1 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 rounded transition-colors shrink-0">
                        <Plus size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Поле збереження результату з Dropdown */}
              <div className="mt-2.5 pt-2.5 border-t border-border/30 flex items-center gap-2">
                <ArrowRight size={10} className="text-emerald-500 shrink-0" />
                <ResultVarDropdown
                  value={ex.resultVar}
                  onChange={(v) => {
                    const next = [...examples];
                    next[exIdx].resultVar = v;
                    data.onDataChange(id, { examples: next });
                  }}
                  variables={globalVars}
                />
              </div>
            </div>
          ))}

          <button 
            onClick={() => data.onDataChange(id, { examples: [...examples, { id: `ex_${Date.now()}`, rows: [{ value: '0', op: '+' }], resultVar: '' }] })}
            className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-dashed border-cyan-500/30 rounded-lg text-cyan-400 text-[10px] font-bold flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Новий розрахунок
          </button>
        </div>
      )}
    </BaseNode>
  );
});

export default CalculatorNode;
