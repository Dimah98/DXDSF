// Нода Змінні — дозволяє мапити дані з JSON (path) у глобальні змінні (name)
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, Plus, Trash2, Edit3, Hash, Search } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const VariableNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  // Масив змінних: name (глобальна назва), path (шлях у JSON), value (поточне значення)
  const variables = data.variables || [{ name: 'wood', path: 'inventory.Wood', value: '0' }];
  
  const updateVariables = (newVars: any[]) => {
    data.onDataChange(id, { variables: newVars });
  };

  const addVar = () => {
    updateVariables([...variables, { name: '', path: '', value: '0' }]);
  };

  const removeVar = (index: number) => {
    const next = [...variables];
    next.splice(index, 1);
    updateVariables(next);
  };

  const handleChange = (index: number, field: string, val: any) => {
    const next = [...variables];
    next[index] = { ...next[index], [field]: val };
    updateVariables(next);

    // Якщо ми міняємо значення вручну — синхронізуємо з глобальною БД
    if (field === 'value' && next[index].name) {
      data.onUpdateVariable?.(next[index].name, val);
    }
    
    // Якщо змінили назву — пробуємо підтягнути існуюче значення з глобальної БД
    if (field === 'name' && val && data.globalVariables?.[val] !== undefined) {
      next[index].value = data.globalVariables[val];
      updateVariables(next);
    }
  };

  return (
    <BaseNode id={id} data={data} icon={<Database size={16} />} title="Змінні" bgColor="bg-amber-500" type="variableNode" width="w-72">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#f59e0b', '20px', mini)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#f59e0b', '20px', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
               <Edit3 size={10} /> Мапінг даних
            </span>
            <button 
              onClick={addVar}
              className="p-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-500 rounded transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-3">
            {variables.map((v: any, idx: number) => {
              const liveValue = data.globalVariables?.[v.name] ?? v.value;
              
              return (
                <div key={idx} className="bg-muted/30 p-2 rounded border border-border/50 relative group/row">
                  {/* Кнопка видалення рядка */}
                  <button 
                    onClick={() => removeVar(idx)}
                    className="absolute -right-2 -top-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity z-10 shadow-lg"
                  >
                    <Trash2 size={10} />
                  </button>

                  <div className="space-y-2">
                    {/* Назва змінної в боті */}
                    <div className="flex items-center gap-2">
                      <div className="w-16 text-[9px] text-amber-500 font-bold uppercase shrink-0">Змінна:</div>
                      <Input 
                        value={v.name}
                        onChange={(e) => handleChange(idx, 'name', e.target.value)}
                        placeholder="назва"
                        className="h-6 text-[9px] bg-[#0f172a] border-slate-700 font-bold text-amber-500 flex-1"
                      />
                    </div>

                    {/* Шлях у JSON коді */}
                    <div className="flex items-center gap-2">
                      <div className="w-16 text-[9px] text-muted-foreground font-bold uppercase shrink-0">Шлях (JSON):</div>
                      <div className="relative flex-1">
                        <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                          value={v.path}
                          onChange={(e) => handleChange(idx, 'path', e.target.value)}
                          placeholder="п-д: inventory.Wood"
                          className="h-6 text-[9px] pl-6 bg-muted/50 border-border"
                        />
                      </div>
                    </div>

                    {/* Поточне значення */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                      <div className="w-16 text-[9px] text-muted-foreground font-bold uppercase shrink-0">Значення:</div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Hash size={8} className="text-muted-foreground" />
                        <Input 
                          value={liveValue}
                          onChange={(e) => handleChange(idx, 'value', e.target.value)}
                          placeholder="0"
                          className="h-5 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 text-foreground font-mono"
                        />
                      </div>
                    </div>
                    
                    {/* Опція скидання */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/10">
                      <label className="flex items-center gap-1.5 text-[9px] text-muted-foreground cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={v.resetIfMissing !== false} 
                          onChange={(e) => handleChange(idx, 'resetIfMissing', e.target.checked)}
                          className="w-2.5 h-2.5 rounded-sm bg-slate-800 border-slate-600 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        Скидати в 0, якщо не знайдено в JSON
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {variables.length === 0 && (
            <div className="text-[9px] text-muted-foreground italic text-center py-2">
              Натисніть [+], щоб додати мапінг
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
});

export default VariableNode;
