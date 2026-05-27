import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, Target, MousePointer, Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const NestedCheckNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Layers size={16} />} title="Вкладена" bgColor="bg-pink-500" type="nestedCheckNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#ec4899', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Виходи Found/Not Found */}
      <Handle type="source" position={Position.Right} id="found"     style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_found" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Батьківський (Selector)</label>
            <div className="flex gap-2">
              <Input 
                value={data.parentSelector || ''} 
                onChange={(e) => data.onDataChange(id, { parentSelector: e.target.value })}
                placeholder=".parent-class"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
              />
              <div className="flex gap-1">
                <button 
                  onClick={() => data.onPickElement && data.onPickElement(id, 'parent')}
                  className="p-1.5 bg-pink-500/20 hover:bg-pink-500/40 text-pink-500 rounded-md transition-colors"
                  title="Вибрати у браузері (ПК)"
                >
                  <MousePointer size={14} />
                </button>
                <button 
                  onClick={() => data.onPickElement?.(id, 'parent')}
                  className="p-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-500 rounded-md transition-colors"
                  title="Live View (Трансляція)"
                >
                  <Camera size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Шуканий (Selector)</label>
            <div className="flex gap-2">
              <Input 
                value={data.childSelector || ''} 
                onChange={(e) => data.onDataChange(id, { childSelector: e.target.value })}
                placeholder=".child-class"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
              />
              <div className="flex gap-1">
                <button 
                  onClick={() => data.onPickElement && data.onPickElement(id, 'child')}
                  className="p-1.5 bg-pink-500/20 hover:bg-pink-500/40 text-pink-500 rounded-md transition-colors"
                  title="Вибрати у браузері (ПК)"
                >
                  <MousePointer size={14} />
                </button>
                <button 
                  onClick={() => data.onPickElement?.(id, 'child')}
                  className="p-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-500 rounded-md transition-colors"
                  title="Live View (Трансляція)"
                >
                  <Camera size={14} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
             <span className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">Знайдено</span>
             <span className="text-[8px] font-bold text-red-500 uppercase tracking-tighter">Немає</span>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default NestedCheckNode;

