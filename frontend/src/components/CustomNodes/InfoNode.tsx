import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Scan, Target, MapPin, Type, Hash, Layers, Image as ImageIcon, ChevronRight, Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const InfoNode = memo(({ id, data }: any) => {
  return (
    <BaseNode id={id} data={data} icon={<Scan size={16} />} title="Сканер" bgColor="bg-teal-500" type="infoNode">
      {/* Вхідний порт (завжди видимий) */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#14b8a6', '20px', data.miniCollapsed)} className="!left-[-6px]" />

      {/* Вихідні порти — розподілені по висоті */}
      <Handle type="source" position={Position.Right} id="coords"   style={getHandleStyle('#3b82f6', data.miniCollapsed ? '20px' : '95px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="text"     style={getHandleStyle('#14b8a6', data.miniCollapsed ? '20px' : '120px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="num"      style={getHandleStyle('#f59e0b', data.miniCollapsed ? '20px' : '145px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="children" style={getHandleStyle('#a855f7', data.miniCollapsed ? '20px' : '170px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="images"   style={getHandleStyle('#ec4899', data.miniCollapsed ? '20px' : '195px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="next"     style={getHandleStyle('#475569', data.miniCollapsed ? '20px' : '230px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <Input 
              value={data.selector || ''} 
              onChange={(e) => data.onDataChange && data.onDataChange(id, { selector: e.target.value })}
              placeholder="Селектор..." 
              className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-7 w-7 p-0 bg-teal-500/20 hover:bg-teal-500/40 text-teal-400 border border-teal-500/30" onClick={() => data.onPickElement && data.onPickElement(id)}>
                <Target size={14} />
              </Button>
              <Button size="sm" className="h-7 w-7 p-0 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 border border-indigo-500/30" onClick={() => window.dispatchEvent(new CustomEvent('trigger-stream-picker', { detail: { nodeId: id } }))}>
                <Camera size={14} />
              </Button>
            </div>
          </div>

          <div className="bg-background/50 rounded-md p-2 border border-border space-y-1">
            <div className="flex items-center gap-2 text-[10px] py-1 border-b border-border text-foreground">
              <MapPin size={12} className="text-teal-500" />
              <span className="font-medium shrink-0 w-20">Координати:</span>
              <span className="text-muted-foreground font-mono truncate">{data.lastCoords || '---'}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] py-1 border-b border-border text-foreground">
              <Type size={12} className="text-teal-500" />
              <span className="font-medium shrink-0 w-20">Текст:</span>
              <span className="text-muted-foreground font-mono truncate">{data.lastText || '---'}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] py-1 border-b border-border text-foreground">
              <Hash size={12} className="text-teal-500" />
              <span className="font-medium shrink-0 w-20">Число:</span>
              <span className="text-muted-foreground font-mono truncate">{data.lastNum || '---'}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] py-1 border-b border-border text-foreground">
              <Layers size={12} className="text-teal-500" />
              <span className="font-medium shrink-0 w-20">Дочірні:</span>
              <span className="text-muted-foreground font-mono truncate">{data.lastChildrenCount || '---'}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] py-1 text-foreground">
              <ImageIcon size={12} className="text-teal-500" />
              <span className="font-medium shrink-0 w-20">Картинки:</span>
              <span className="text-muted-foreground font-mono truncate">{data.lastImagesCount || '---'}</span>
            </div>
          </div>

          {/* Списки знайдених назв */}
          {(data.imageNames?.length > 0 || data.childrenNames?.length > 0) && (
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1 border-t border-border pt-2">
              {data.imageNames?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-teal-600 uppercase flex items-center gap-1">
                    <ImageIcon size={10} /> Картинки ({data.imageNames.length})
                  </div>
                  {data.imageNames.map((name: string, i: number) => (
                    <div key={i} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                      <ChevronRight size={8} /> {name}
                    </div>
                  ))}
                </div>
              )}
              {data.childrenNames?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-teal-600 uppercase flex items-center gap-1">
                    <Layers size={10} /> Дочірні ({data.childrenNames.length})
                  </div>
                  {data.childrenNames.map((item: any, i: number) => (
                    <div key={i} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                      <ChevronRight size={8} /> {item.name} <span className="opacity-40 italic">({item.selector})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between pt-1 border-t border-border">
             <span className="text-[9px] uppercase text-muted-foreground font-bold italic">Наступна дія</span>
             <div className="w-4 h-4" /> 
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default InfoNode;
