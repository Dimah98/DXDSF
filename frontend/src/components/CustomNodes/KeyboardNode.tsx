import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Keyboard, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import BaseNode, { getHandleStyle } from './BaseNode';

const KeyboardNode = memo(({ id, data }: any) => {
  const keys = data.keys || [];

  return (
    <BaseNode id={id} data={data} icon={<Keyboard size={16} />} title="Макрос" bgColor="bg-slate-600" type="keyboardNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#475569', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#475569', '20px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {keys.map((k: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-md border border-border group">
                   <div className="flex items-center gap-3">
                      <div className="min-w-[40px] px-2 py-1 bg-background rounded border border-border shadow-sm text-center">
                         <span className="text-[10px] font-mono font-bold text-foreground">{k.key}</span>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[8px] font-bold text-muted-foreground uppercase">Пауза</span>
                         <span className="text-[10px] font-mono text-slate-500">{k.delay}мс</span>
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        const newKeys = keys.filter((_: any, idx: number) => idx !== i);
                        data.onDataChange(id, { keys: newKeys });
                     }}
                     className="p-1.5 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                   >
                      <Trash2 size={12} />
                   </button>
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
              const newKeys = [...keys, { key: 'Enter', delay: 200 }];
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
