import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Search, Image as ImageIcon, Target, Check, X, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const API_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? `http://localhost:3001` 
  : '';

const ImageSearchNode = memo(({ id, data }: any) => {
  const [imageList, setImageList] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_HOST}/api/images`)
      .then(res => res.json())
      .then(setImageList)
      .catch(console.error);
  }, []);

  return (
    <BaseNode id={id} data={data} icon={<Search size={16} />} title="Пошук картинок" bgColor="bg-indigo-500" type="imageSearchNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#6366f1', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Вихідні порти */}
      <Handle type="source" position={Position.Right} id="found"     style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="not_found" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="coords"    style={getHandleStyle('#3b82f6', data.miniCollapsed ? '50%' : '100px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <ImageIcon size={12} /> Назва файлу
            </label>
            <div className="relative group">
              <Input 
                list={`images-${id}`}
                value={data.imageName || ''} 
                onChange={(e) => data.onDataChange(id, { imageName: e.target.value })} 
                placeholder="resource.png" 
                className="h-8 text-xs bg-muted border-none focus:ring-1 ring-indigo-500" 
              />
              <datalist id={`images-${id}`}>
                {imageList.map(img => <option key={img} value={img} />)}
                {imageList.map(img => <option key={img + '-noext'} value={img.split('.')[0]} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground italic opacity-70">Область пошуку</label>
            <div className="flex gap-2">
              <Input 
                value={data.selector || ''} 
                onChange={(e) => data.onDataChange(id, { selector: e.target.value })}
                placeholder="Весь екран" 
                className="h-7 text-[10px] font-mono border-border bg-muted text-muted-foreground" 
              />
              <Button size="sm" className="h-7 w-7 p-0 bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => data.onPickElement && data.onPickElement(id)}>
                <Target size={14} />
              </Button>
            </div>
          </div>

          <div className="pt-1 border-t border-border flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-[8px] font-bold text-green-500 uppercase tracking-tighter">
                   <Check size={10} /> ТАК
                </div>
                <div className="flex items-center gap-1 text-[8px] font-bold text-red-500 uppercase tracking-tighter">
                   НІ <X size={10} />
                </div>
             </div>
             <div className="flex items-center gap-1 text-indigo-500">
                <MapPin size={10} />
                <span className="text-[10px] font-mono font-bold">{data.receivedValue || "---"}</span>
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default ImageSearchNode;
