import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, Plus, X, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const VariableNode = memo(({ id, data }: any) => {
  const variables = data.variables || [];

  return (
    <BaseNode id={id} data={data} icon={<Database size={16} />} title="Змінні" bgColor="bg-amber-600" type="variableNode" width="w-72">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#d97706', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#d97706', '20px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-2">
          <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {variables.map((v: any, i: number) => (
              <div key={i} className="bg-muted p-2 rounded border border-border space-y-1.5 relative group">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-primary uppercase">Запис #{i+1}</span>
                    <button onClick={() => {
                       const newVars = variables.filter((_: any, idx: number) => idx !== i);
                       data.onDataChange(id, { variables: newVars });
                    }} className="text-muted-foreground hover:text-red-500 transition-colors"><X size={12} /></button>
                 </div>
                 <div className="flex items-center gap-1">
                    <Input 
                      value={v.path} 
                      onChange={(e) => {
                         const newVars = [...variables]; 
                         newVars[i].path = e.target.value;
                         data.onDataChange(id, { variables: newVars });
                      }} 
                      placeholder="path.to.val" 
                      className="h-6 text-[9px] border-border bg-background text-foreground" 
                    />
                    <ChevronRight size={10} className="text-muted-foreground" />
                    <Input 
                      value={v.name} 
                      onChange={(e) => {
                         const newVars = [...variables]; 
                         newVars[i].name = e.target.value;
                         data.onDataChange(id, { variables: newVars });
                      }} 
                      placeholder="VarName" 
                      className="h-6 text-[9px] border-border font-bold bg-background text-foreground" 
                    />
                 </div>
                 <div className="bg-background/50 rounded px-2 py-1 border border-border flex items-center gap-1">
                    <span className="text-[8px] text-primary font-bold shrink-0">=</span>
                    <span className={`text-[10px] font-mono truncate ${
                       data.currentValues && data.currentValues[v.name] !== undefined 
                         ? 'text-emerald-600 font-bold' 
                         : 'text-muted-foreground italic'
                    }`}>
                       {data.currentValues && data.currentValues[v.name] !== undefined 
                         ? String(data.currentValues[v.name]) 
                         : 'ще не визначено'}
                    </span>
                 </div>
              </div>
            ))}
          </div>

          <Button 
            size="sm" 
            variant="outline" 
            className="w-full h-7 text-[10px] border-dashed border-border bg-accent/10 hover:bg-accent/30 text-foreground" 
            onClick={() => {
               const newVars = [...variables, { path: '', name: 'myVar' }];
               data.onDataChange(id, { variables: newVars });
            }}
          >
             <Plus size={12} className="mr-1" /> Додати змінну
          </Button>
        </div>
      )}
    </BaseNode>
  );
});

export default VariableNode;
