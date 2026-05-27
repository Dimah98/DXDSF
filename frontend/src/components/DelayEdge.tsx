import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';

export default function DelayEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as any;

  const onDelayChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    if (edgeData?.onDelayChange) {
      edgeData.onDelayChange(id, parseInt(evt.target.value) || 0);
    }
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (edgeData?.onDelete) {
      edgeData.onDelete(id);
    }
  };

  // Показуємо поле тільки якщо лінія виділена АБО якщо там вже є затримка
  if (!selected && !(edgeData?.delay > 0)) return <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />;

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? '#3b82f6' : '#94a3b8',
          transition: 'all 0.2s'
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 10,
            pointerEvents: 'all',
            opacity: selected ? 1 : 0.8,
            transition: 'all 0.2s',
            zIndex: selected ? 1000 : 1
          }}
          className="nodrag nopan"
        >
          <div className={`flex items-center bg-white border rounded-full shadow-sm px-2 py-0.5 gap-1.5 ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300'}`}>
             <div className="flex items-center gap-0.5">
               <input
                  type="number"
                  defaultValue={edgeData?.delay || 0}
                  onChange={onDelayChange}
                  className="w-10 h-5 text-[10px] font-bold text-center outline-none bg-transparent [appearance:textfield] text-slate-700"
                  placeholder="0"
               />
               <span className="text-[8px] text-slate-400 font-bold uppercase">ms</span>
             </div>
             
             {selected && (
               <button 
                 onClick={onDelete}
                 className="p-0.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors border-l pl-1.5 border-slate-100"
               >
                 <X size={12} />
               </button>
             )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
