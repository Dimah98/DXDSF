import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Search, Target, Check, X, Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const SearchInNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Search size={16} />} title="Пошук у блоці" bgColor="bg-indigo-500" type="searchInNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#6366f1', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} id="found" style={getHandleStyle('#10b981', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_found" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Контекст (Батьківський)</label>
            <div className="flex gap-2">
              <Input 
                value={data.parentSelector || ''} 
                onChange={(e) => data.onDataChange(id, { parentSelector: e.target.value })}
                placeholder=".container-class"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
              />
              <Button size="sm" className="h-7 w-7 p-0 bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => data.onPickElement && data.onPickElement(id, 'parent')}>
                <Target size={14} />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Шукати всередині</label>
            <div className="flex gap-2">
              <Input 
                value={data.childSelector || ''} 
                onChange={(e) => data.onDataChange(id, { childSelector: e.target.value })}
                placeholder=".child-element"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 w-7 p-0 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 border border-indigo-500/30" onClick={() => data.onPickElement && data.onPickElement(id, 'child')}>
                  <Target size={14} />
                </Button>
                <Button size="sm" className="h-7 w-7 p-0 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 border border-indigo-500/30" onClick={() => window.dispatchEvent(new CustomEvent('trigger-stream-picker', { detail: { nodeId: id, pickType: 'child' } }))}>
                  <Camera size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
             <div className="flex items-center gap-1 text-[8px] font-bold text-green-500 uppercase tracking-tighter">
                <Check size={10} /> Знайдено
             </div>
             <div className="flex items-center gap-1 text-[8px] font-bold text-red-500 uppercase tracking-tighter">
                Немає <X size={10} />
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default SearchInNode;
