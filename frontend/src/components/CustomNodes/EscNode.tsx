import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { XCircle } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const EscNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<XCircle size={16} />} title="Натиснути ESC" bgColor="bg-slate-700" type="escNode" width="w-40">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#64748b', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#64748b', '20px', data.miniCollapsed)} className="!right-[-6px]" />
      
      {!data.miniCollapsed && (
        <div className="p-3 flex flex-col items-center justify-center gap-2">
           <div className="text-[10px] font-bold text-muted-foreground uppercase text-center">
             Закрити вікно / меню
           </div>
           <kbd className="px-2 py-1.5 bg-muted border border-border rounded text-xs font-black shadow-sm">ESC</kbd>
        </div>
      )}
    </BaseNode>
  );
});

export default EscNode;
