import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(234, 179, 8, ${alpha})`; // fallback to yellow
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CommentNode = memo(({ id, data, selected }: any) => {
  const color = data.color || '#eab308'; // Default yellow
  
  // Custom styles based on color
  const bgStyle = hexToRgba(color, 0.15); // bg-opacity 15%
  const borderStyle = hexToRgba(color, 0.5); // border-opacity 50%
  const textTitleStyle = hexToRgba(color, 0.7);

  return (
    <>
      <NodeResizer 
        color={color} 
        isVisible={selected} 
        minWidth={160} 
        minHeight={80} 
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }} 
      />
      
      <div
        className="relative flex flex-col rounded-xl border-2 border-dashed shadow-lg"
        style={{ 
          padding: '10px 14px', 
          backgroundColor: bgStyle,
          borderColor: borderStyle,
          backdropFilter: 'blur(4px)',
          width: '100%',
          height: '100%',
          minWidth: 160,
          minHeight: 80
        }}
      >
        {/* Прозорий вхід і вихід — щоб ноду можна було підключити до схеми */}
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: 'none',
            left: -4,
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: 'none',
            right: -4,
          }}
        />

        {/* Заголовок коментаря */}
        <div className="flex items-center justify-between mb-2 drag-handle cursor-grab shrink-0">
          <div className="flex items-center gap-1.5">
            <MessageSquare size={12} style={{ color }} className="shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: textTitleStyle }}>
              Коментар
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <input 
              type="number" 
              value={data.fontSize || 12} 
              onChange={(e) => data.onDataChange && data.onDataChange(id, { fontSize: Number(e.target.value) })}
              className="w-10 h-4 bg-black/20 text-white text-[9px] text-center border border-white/20 rounded outline-none"
              title="Розмір тексту (px)"
              min={8}
              max={200}
            />
            <input 
              type="color" 
              value={color} 
              onChange={(e) => data.onDataChange && data.onDataChange(id, { color: e.target.value })}
              className="w-4 h-4 p-0 rounded border-0 cursor-pointer outline-none bg-transparent"
              title="Змінити колір коментаря"
            />
          </div>
        </div>

        {/* Текстове поле — редагується прямо на ноді */}
        <textarea
          value={data.comment || ''}
          onChange={(e) =>
            data.onDataChange && data.onDataChange(id, { comment: e.target.value })
          }
          placeholder="Введіть нотатку..."
          className="nodrag nowheel resize-none bg-transparent placeholder:opacity-40 outline-none leading-tight flex-1 w-full"
          style={{ 
            border: 'none', 
            padding: 0, 
            color: '#e2e8f0', // Light slate text
            margin: 0,
            fontSize: `${data.fontSize || 12}px`
          }}
        />
      </div>
    </>
  );
});

export default CommentNode;
