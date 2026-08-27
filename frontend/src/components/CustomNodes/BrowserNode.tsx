import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { getDynamicIcon } from '../../utils/dynamicIcon';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const BrowserNode = memo(({ id, data }: { id: string, data: any }) => {
  const IconComponent = getDynamicIcon(data.customIcon) || Globe;

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
              // Значення вибраної дії (за замовчуванням оновлення)
              value={data.browser_action || 'refresh'} 
              // Обробник вибору нової дії зі збереженням у стан ноди
              onChange={(e) => data.onDataChange(id, { browser_action: e.target.value })} 
              // Стилізація випадаючого списку дій браузера
              className="w-full h-7 text-xs border rounded bg-muted text-muted-foreground border-border px-1 outline-none focus:ring-1 ring-purple-500 transition-all"
            >
              {/* Опція оновлення сторінки */}
              <option value="refresh">Оновити сторінку</option>
              {/* Опція емуляції клавіші F5 */}
              <option value="f5">Натиснути F5</option>
              {/* Опція повернення на попередню сторінку в історії */}
              <option value="back">Назад</option>
              {/* Опція очікування спокою мережі */}
              <option value="wait_load">Чекати завантаження</option>
              {/* Опція віддалення камери за допомогою Ctrl + прокрутка */}
              <option value="zoom_out">Віддалити камеру (Ctrl+Scroll)</option>
              {/* Опція переходу на випадкову ферму проекту */}
              <option value="random_pt">Рандом ПТ</option>
              {/* Опція примусового закриття сесії браузера */}
              <option value="close">Закрити браузер</option>
            </select>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default BrowserNode;
