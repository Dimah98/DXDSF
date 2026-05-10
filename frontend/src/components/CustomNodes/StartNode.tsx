import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const StartNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Play size={16} fill="currentColor" />} title="Початок" bgColor="bg-slate-500" type="startNode" width="w-40">
      <Handle type="source" position={Position.Right} style={getHandleStyle('#64748b', '20px', data.miniCollapsed)} className="!right-[-6px]" />
      
      {!data.miniCollapsed && (
        <div className="p-4 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-500/20 flex items-center justify-center animate-pulse border border-slate-500/30">
             <div className="w-4 h-4 rounded-full bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.5)]" />
          </div>
          <div className="text-[10px] text-muted-foreground text-center font-medium italic px-2">
            Точка входу
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default StartNode;
