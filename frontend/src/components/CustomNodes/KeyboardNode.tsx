import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Keyboard, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import BaseNode, { getHandleStyle } from './BaseNode';

const KeyboardNode = memo(({ id, data }: any) => {
  const keys = data.keys || [];

  const updateKey = (index: number, field: string, value: any) => {
    const newKeys = [...keys];
    newKeys[index] = { ...newKeys[index], [field]: value };
    data.onDataChange(id, { keys: newKeys });
  };

  return (
    <BaseNode id={id} data={data} icon={<Keyboard size={16} />} title="Макрос" bgColor="bg-slate-600" type="keyboardNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#475569', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#475569', '20px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3 w-[260px] nodrag cursor-default">
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {keys.map((k: any, i: number) => (
                <div key={i} className="flex flex-col bg-muted/50 p-2 rounded-md border border-border group gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase">Дія #{i + 1}</span>
                     <button 
                       onClick={() => {
                          const newKeys = keys.filter((_: any, idx: number) => idx !== i);
                          data.onDataChange(id, { keys: newKeys });
                       }}
                       className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                     >
                        <Trash2 size={12} />
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-1">
                       <label className="text-[9px] text-muted-foreground uppercase">Кнопка 1</label>
                       <input 
                         type="text" 
                         className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground"
                         value={k.key || ''} 
                         onChange={(e) => updateKey(i, 'key', e.target.value)} 
                         placeholder="e.g. Enter"
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[9px] text-muted-foreground uppercase">Кнопка 2 (опц.)</label>
                       <input 
                         type="text" 
                         className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground"
                         value={k.key2 || ''} 
                         onChange={(e) => updateKey(i, 'key2', e.target.value)}
                         placeholder="e.g. Shift"
                       />
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-1">
                       <label className="text-[9px] text-muted-foreground uppercase">Утримання (мс)</label>
                       <input 
                         type="number" 
                         className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground"
                         value={k.holdTime || 0} 
                         onChange={(e) => updateKey(i, 'holdTime', Number(e.target.value))} 
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[9px] text-muted-foreground uppercase">Пауза після (мс)</label>
                       <input 
                         type="number" 
                         className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground"
                         value={k.delay || 0} 
                         onChange={(e) => updateKey(i, 'delay', Number(e.target.value))} 
                       />
                     </div>
                   </div>
                </div>
             ))}
             {keys.length === 0 && (
               <div className="text-[10px] text-muted-foreground italic text-center py-4 bg-muted/20 rounded-md border border-dashed">
                 Список порожній
               </div>
             )}
          </div>

          <Button 
            size="sm" 
            variant="outline" 
            className="w-full h-8 text-[10px] border-dashed border-border bg-accent/10 hover:bg-accent/30 text-foreground" 
            onClick={() => {
              const newKeys = [...keys, { key: 'Enter', key2: '', holdTime: 0, delay: 200 }];
              data.onDataChange(id, { keys: newKeys });
            }}
          >
             <Plus size={12} className="mr-1" /> Додати дію клавіш
          </Button>
        </div>
      )}
    </BaseNode>
  );
});

export default KeyboardNode;
