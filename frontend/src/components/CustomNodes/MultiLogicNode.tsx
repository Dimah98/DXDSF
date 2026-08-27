import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitFork, Plus, X, ChevronDown, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import BaseNode, { getHandleStyle } from './BaseNode';

// Оператори порівняння
const OPERATORS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: '==', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'time_is_today', label: '📅 = сьогодні (з 03:00)' },
  { value: 'time_not_today', label: '📅 ≠ сьогодні (з 03:00)' },
];

const LOGIC_OPS = [
  { value: '&&', label: 'І (AND)' },
  { value: '||', label: 'АБО (OR)' },
];

const VarSelect = ({ value, onChange, variables }: { value: string, onChange: (v: string) => void, variables: string[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-6 px-2 text-[10px] font-bold bg-muted border border-border rounded flex items-center gap-1 min-w-[60px] hover:bg-accent/20 transition-colors text-foreground"
      >
        <span className="truncate">{value || 'Обери...'}</span>
        <ChevronDown size={10} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute top-7 left-0 z-50 bg-card border border-border rounded shadow-lg max-h-32 overflow-y-auto min-w-[100px]">
          {variables.length === 0 ? (
            <div className="p-2 text-[9px] text-muted-foreground italic">Немає</div>
          ) : (
            variables.map(v => (
              <button
                key={v}
                onClick={() => { onChange(v); setOpen(false); }}
                className={`w-full text-left px-2 py-1 text-[10px] hover:bg-muted ${value === v ? 'bg-primary/20 font-bold' : ''}`}
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

const MultiLogicNode = memo(({ id, data }: any) => {
  const conditions = data.conditions || [];
  // Отримуємо список назв із глобальних змінних проекту
  const savedVarNames = data.globalVariables ? Object.keys(data.globalVariables) : [];

  const buildExpression = (cond: any) => {
    const rules = cond.rules || [];
    const logicOp = cond.logicOp || '&&';
    return rules
      .filter((r: any) => r.varName)
      .map((r: any) => `${r.varName} ${r.op} ${r.value}`)
      .join(` ${logicOp} `);
  };

  const updateRule = (condIdx: number, ruleIdx: number, field: string, value: string) => {
    const newConds = JSON.parse(JSON.stringify(conditions));
    if (!newConds[condIdx].rules) newConds[condIdx].rules = [{ varName: '', op: '>', value: '0' }];
    newConds[condIdx].rules[ruleIdx][field] = value;
    newConds[condIdx].expression = buildExpression(newConds[condIdx]);
    data.onDataChange(id, { conditions: newConds });
  };

  const updateLogicOp = (condIdx: number, value: string) => {
    const newConds = JSON.parse(JSON.stringify(conditions));
    newConds[condIdx].logicOp = value;
    newConds[condIdx].expression = buildExpression(newConds[condIdx]);
    data.onDataChange(id, { conditions: newConds });
  };

  const addRule = (condIdx: number) => {
    const newConds = JSON.parse(JSON.stringify(conditions));
    if (!newConds[condIdx].rules) newConds[condIdx].rules = [];
    newConds[condIdx].rules.push({ varName: '', op: '>', value: '0' });
    newConds[condIdx].expression = buildExpression(newConds[condIdx]);
    data.onDataChange(id, { conditions: newConds });
  };

  const removeRule = (condIdx: number, ruleIdx: number) => {
    const newConds = JSON.parse(JSON.stringify(conditions));
    newConds[condIdx].rules.splice(ruleIdx, 1);
    newConds[condIdx].expression = buildExpression(newConds[condIdx]);
    data.onDataChange(id, { conditions: newConds });
  };

  return (
    <BaseNode id={id} data={data} icon={<GitFork size={16} />} title="Логічний ХАБ" bgColor="bg-violet-500" type="multiLogicNode" width="w-80">
      {/* Вхідний порт */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#8b5cf6', '20px', data.miniCollapsed)} className="!left-[-6px]" />

      {/* Динамічні порти умов */}
      {conditions.map((_: any, i: number) => (
        <Handle
          key={`out_${i}`}
          type="source"
          position={Position.Right}
          id={`out_${i}`}
          style={getHandleStyle('#a855f7', 100 + i * 80, data.miniCollapsed)}
          className="!right-[-6px]"
        />
      ))}

      {/* Динамічні вхідні порти значень умов */}
      {conditions.map((_: any, i: number) => (
        <Handle
          key={`in_${i}`}
          type="target"
          position={Position.Left}
          id={`val_${i}`}
          style={getHandleStyle('#f59e0b', 100 + i * 80, data.miniCollapsed)}
          className="!left-[-6px]"
        />
      ))}
      
      {/* Порт "Інакше" */}
      <Handle type="source" position={Position.Right} id="default" style={getHandleStyle('#ef4444', 'calc(100% - 15px)', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {conditions.map((c: any, i: number) => {
              const rules = c.rules || [];
              return (
                <div key={i} className="bg-muted p-2 rounded border border-border relative space-y-1.5 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-violet-600 uppercase">Умова #{i + 1}</span>
                      {/* Чекбокс автоматичного запуску при надходженні через val_* порт */}
                      <label 
                        className="flex items-center gap-0.5 cursor-pointer group/zap"
                        title="Авто-запуск: при надходженні даних у вхід умови — запустити перевірку автоматично"
                      >
                        <input
                          type="checkbox"
                          checked={c.triggerOnInput || false}
                          onChange={(e) => {
                            const newConds = JSON.parse(JSON.stringify(conditions));
                            newConds[i].triggerOnInput = e.target.checked;
                            data.onDataChange(id, { conditions: newConds });
                          }}
                          className="w-2.5 h-2.5 rounded border-none bg-violet-500/20 text-violet-500 focus:ring-0 cursor-pointer"
                        />
                        <Zap size={9} className={`transition-colors ${c.triggerOnInput ? 'text-amber-400' : 'text-muted-foreground group-hover/zap:text-amber-400/50'}`} />
                      </label>
                    </div>
                    <button onClick={() => {
                      const newConds = conditions.filter((_: any, idx: number) => idx !== i);
                      data.onDataChange(id, { conditions: newConds });
                    }} className="text-muted-foreground hover:text-red-500 transition-colors"><X size={12} /></button>
                  </div>

                  {rules.map((rule: any, ri: number) => (
                    <div key={ri} className="space-y-1.5">
                      {ri > 0 && (
                        <div className="flex justify-center">
                          <select 
                            value={c.logicOp || '&&'} 
                            onChange={(e) => updateLogicOp(i, e.target.value)} 
                            className="text-[8px] font-bold bg-violet-100 text-violet-700 rounded px-1 outline-none border border-violet-200"
                          >
                            {LOGIC_OPS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <VarSelect value={rule.varName} onChange={(v) => updateRule(i, ri, 'varName', v)} variables={savedVarNames} />
                        <select 
                          value={rule.op} 
                          onChange={(e) => updateRule(i, ri, 'op', e.target.value)} 
                          className="h-6 text-[11px] bg-background border border-border rounded px-1 w-10 text-foreground outline-none"
                        >
                          {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                        <input 
                          type="text" 
                          value={rule.value} 
                          onChange={(e) => updateRule(i, ri, 'value', e.target.value)} 
                          className="h-6 text-[10px] bg-background border border-border rounded px-1 w-full text-foreground outline-none focus:ring-1 ring-violet-500" 
                        />
                        {rules.length > 1 && (
                          <button onClick={() => removeRule(i, ri)} className="text-muted-foreground hover:text-red-500 transition-colors">
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addRule(i)} className="w-full py-1 text-[8px] text-violet-600 font-bold hover:bg-violet-500/10 rounded border border-dashed border-violet-500/30 transition-colors">
                    + додати правило
                  </button>
                </div>
              );
            })}
          </div>

          <Button 
            size="sm" 
            variant="outline" 
            className="w-full h-8 text-[10px] border-dashed border-border bg-accent/10 hover:bg-accent/30 text-foreground" 
            onClick={() => {
               const newConds = [...conditions, { rules: [{ varName: '', op: '>', value: '0' }], logicOp: '&&', expression: '' }];
               data.onDataChange(id, { conditions: newConds });
            }}
          >
            <Plus size={12} className="mr-1" /> Додати нову гілку
          </Button>

          <div className="p-2 bg-muted/50 rounded-md border border-dashed border-border flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-bold uppercase">Інакше (Default) →</span>
            <div className="w-4 h-4" />
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default MultiLogicNode;
