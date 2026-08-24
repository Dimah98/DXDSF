import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Crosshair, MousePointer2, Hash } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const CoordClickNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Crosshair size={16} />} title="Клік (X,Y)" bgColor="bg-cyan-500" type="coordClickNode" width="w-52">
      {/* Входи */}
      <Handle type="target" position={Position.Left} id="execute" style={getHandleStyle('#06b6d4', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="update_coords" style={getHandleStyle('#14b8a6', data.miniCollapsed ? '20px' : '85px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="target" position={Position.Left} id="update_count" style={getHandleStyle('#f59e0b', data.miniCollapsed ? '20px' : '135px', data.miniCollapsed)} className="!left-[-6px]" />

      {/* Вихід */}
      <Handle type="source" position={Position.Right} style={getHandleStyle('#a855f7', '20px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          {/* Координати */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold text-cyan-600 uppercase">Координати</span>
              <span className="text-[7px] text-teal-500 font-bold italic">← Порт запису</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
               <div className="flex items-center gap-1 bg-muted/30 p-1 rounded border border-border">
                  <span className="text-[9px] font-bold text-cyan-500">X:</span>
                  <Input type="number" value={data.x || 0} onChange={(e) => data.onDataChange(id, { x: parseInt(e.target.value) || 0 })} className="h-6 text-[10px] border-none bg-transparent p-0 focus-visible:ring-0 text-center text-foreground" />
               </div>
               <div className="flex items-center gap-1 bg-muted/30 p-1 rounded border border-border">
                  <span className="text-[9px] font-bold text-cyan-500">Y:</span>
                  <Input type="number" value={data.y || 0} onChange={(e) => data.onDataChange(id, { y: parseInt(e.target.value) || 0 })} className="h-6 text-[10px] border-none bg-transparent p-0 focus-visible:ring-0 text-center text-foreground" />
               </div>
            </div>
          </div>

          {/* Зсув координат */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold text-purple-600 uppercase">Зсув координат</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
               <div className="flex items-center gap-1 bg-muted/30 p-1 rounded border border-border">
                  <span className="text-[9px] font-bold text-purple-500">X:</span>
                  <Input type="number" value={data.offsetX || 0} onChange={(e) => data.onDataChange(id, { offsetX: parseInt(e.target.value) || 0 })} className="h-6 text-[10px] border-none bg-transparent p-0 focus-visible:ring-0 text-center text-foreground" />
               </div>
               <div className="flex items-center gap-1 bg-muted/30 p-1 rounded border border-border">
                  <span className="text-[9px] font-bold text-purple-500">Y:</span>
                  <Input type="number" value={data.offsetY || 0} onChange={(e) => data.onDataChange(id, { offsetY: parseInt(e.target.value) || 0 })} className="h-6 text-[10px] border-none bg-transparent p-0 focus-visible:ring-0 text-center text-foreground" />
               </div>
            </div>
          </div>

          {/* Кількість повторів */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[8px] font-bold text-amber-600 uppercase">
                 <Hash size={10} />
                 <span>Кількість кліків</span>
              </div>
              <span className="text-[7px] text-amber-500 font-bold italic font-sans">← Порт числа або змінна</span>
            </div>
            <Input 
              type="text" 
              value={data.clickCount !== undefined ? data.clickCount : '1'} 
              onChange={(e) => data.onDataChange(id, { clickCount: e.target.value })} 
              placeholder="1 або {змінна}"
              className="h-7 text-xs border-border bg-muted/30 text-foreground font-mono" 
            />
          </div>

           <div className="pt-1 border-t border-border flex flex-col items-start justify-center gap-1.5">
             <label className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={data.isUIElement || false} 
                 onChange={(e) => data.onDataChange(id, { isUIElement: e.target.checked })} 
                 className="rounded bg-muted/50 border-border text-cyan-500 focus:ring-cyan-500 w-3 h-3" 
               />
               <span>Елемент інтерфейсу (не тягнути карту)</span>
             </label>
             <label className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={data.ignoreContextCoords || false} 
                 onChange={(e) => data.onDataChange(id, { ignoreContextCoords: e.target.checked })} 
                 className="rounded bg-muted/50 border-border text-cyan-500 focus:ring-cyan-500 w-3 h-3" 
               />
               <span>Ігнорувати вхідні координати (тільки записані)</span>
             </label>
             <div className="flex items-center gap-2 pt-1 self-center">
               <MousePointer2 size={10} className="text-cyan-400" />
               <span className="text-[9px] text-muted-foreground italic">Клікне {data.clickCount || 1} раз(и)</span>
             </div>
           </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CoordClickNode;
