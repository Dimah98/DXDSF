import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { Globe } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const BrowserNode = memo(({ id, data }: { id: string, data: any }) => {
  const IconComponent = data.customIcon && (LucideIcons as any)[data.customIcon] 
    ? (LucideIcons as any)[data.customIcon] 
    : Globe;

  return (
    <BaseNode id={id} data={data} icon={<IconComponent size={16} />} title={data.label || 'Браузер'} bgColor="bg-purple-500" type="browserNode">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#8b5cf6', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} style={getHandleStyle('#8b5cf6', '20px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2 italic">
               <Globe size={12} /> Перейти за URL
            </label>
            <Input 
              value={data.url || ''} 
              onChange={(e) => data.onDataChange(id, { url: e.target.value })} 
              placeholder="https://..." 
              className="h-7 text-[10px] font-mono border-border bg-muted text-muted-foreground focus:ring-1 ring-purple-500 transition-all outline-none" 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2 italic">
               Дія браузера
            </label>
            <select 
              value={data.browser_action || 'refresh'} 
              onChange={(e) => data.onDataChange(id, { browser_action: e.target.value })} 
              className="w-full h-7 text-xs border rounded bg-muted text-muted-foreground border-border px-1 outline-none focus:ring-1 ring-purple-500 transition-all"
            >
              <option value="refresh">Оновити сторінку</option>
              <option value="back">Назад</option>
              <option value="wait_load">Чекати завантаження</option>
            </select>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default BrowserNode;
