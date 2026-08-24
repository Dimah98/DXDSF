import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera, Image as ImageIcon, MousePointer2 } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const VisualSearchNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Camera size={16} />} title="Візуальний зір" bgColor="bg-emerald-500" type="visualSearchNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#10b981', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Виходи Found/Not Found */}
      <Handle type="source" position={Position.Right} id="found"     style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_found" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <ImageIcon size={12} /> Еталони (кожен з нового рядка)
            </label>
            <textarea 
              value={data.imageName || ''} 
              onChange={(e) => data.onDataChange(id, { imageName: e.target.value })} 
              placeholder="seedling.png&#10;plant.png&#10;tree.png" 
              rows={3}
              className="w-full px-3 py-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-emerald-500 resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Точність пошуку</label>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-1.5 rounded">
                {Math.round((data.threshold || 0.8) * 100)}%
              </span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.05" 
              value={data.threshold || 0.8} 
              onChange={(e) => data.onDataChange(id, { threshold: parseFloat(e.target.value) })} 
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500" 
            />
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
             <div className="flex items-center gap-1.5">
                <MousePointer2 size={12} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Результат:</span>
             </div>
             <span className="text-[10px] font-mono font-bold text-emerald-600">
               {data.receivedValue || "---"}
             </span>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default VisualSearchNode;
