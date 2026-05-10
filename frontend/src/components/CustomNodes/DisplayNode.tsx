import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Monitor, Terminal } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const DisplayNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Monitor size={16} />} title="Вивід" bgColor="bg-slate-600" type="displayNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#475569', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Terminal size={12} /> Результат виконання
             </label>
             <div className="bg-muted p-2.5 rounded-md border border-border min-h-[80px] max-h-[150px] overflow-y-auto custom-scrollbar">
                <pre className="text-[10px] font-mono text-emerald-500 whitespace-pre-wrap leading-relaxed">
                   {data.value || 'Чекаємо на дані...'}
                </pre>
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default DisplayNode;
