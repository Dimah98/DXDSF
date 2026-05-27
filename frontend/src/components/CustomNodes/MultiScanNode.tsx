import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, Plus, Trash2, MousePointer, Search, Camera } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const MultiScanNode = memo(({ id, data }: { id: string, data: any }) => {
  const items = data.scanItems || [{ selector: '', condition: '>', value: '3' }];

  const updateItems = (newItems: any[]) => {
    data.onDataChange(id, { scanItems: newItems });
  };

  const addItem = () => {
    updateItems([...items, { selector: '', condition: '>', value: '3' }]);
  };

  const removeItem = (index: number) => {
    updateItems(items.filter((_: any, i: number) => i !== index));
  };

  const updateItem = (index: number, field: string, val: any) => {
    updateItems(items.map((item: any, i: number) => i === index ? { ...item, [field]: val } : item));
  };

  return (
    <BaseNode id={id} data={data} icon={<Layers size={16} />} title="Мульти-Сканер" bgColor="bg-cyan-600" type="multiScanNode" width="w-80">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#0891b2', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {/* Виходи */}
      <div className="absolute right-[-6px] top-[20px] flex flex-col gap-6">
        <div className="relative">
           <Handle type="source" position={Position.Right} id="success" style={getHandleStyle('#22c55e', 0, data.miniCollapsed)} />
           {!data.miniCollapsed && <span className="absolute right-3 top-[-8px] text-[8px] font-bold text-green-500 uppercase">Знайдено</span>}
        </div>
        <div className="relative">
           <Handle type="source" position={Position.Right} id="coords" style={getHandleStyle('#06b6d4', 0, data.miniCollapsed)} />
           {!data.miniCollapsed && <span className="absolute right-3 top-[-8px] text-[8px] font-bold text-cyan-500 uppercase">Координати</span>}
        </div>
        <div className="relative">
           <Handle type="source" position={Position.Right} id="fail" style={getHandleStyle('#ef4444', 0, data.miniCollapsed)} />
           {!data.miniCollapsed && <span className="absolute right-3 top-[-8px] text-[8px] font-bold text-red-500 uppercase">Нічого</span>}
        </div>
      </div>

      {!data.miniCollapsed && (
        <div className="p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                 <Search size={12} /> Список цілей
               </label>
               <button 
                 onClick={addItem}
                 className="p-1 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-500 rounded transition-colors"
               >
                 <Plus size={12} />
               </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {items.map((item: any, index: number) => (
                <div key={index} className="p-2 bg-muted/50 rounded-lg border border-border/50 relative group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-500 text-[9px] flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <input 
                      type="text" 
                      value={item.selector} 
                      onChange={(e) => updateItem(index, 'selector', e.target.value)}
                      placeholder="Селектор..."
                      className="flex-1 bg-background border-none p-1.5 text-[10px] rounded focus:ring-1 ring-cyan-500 outline-none font-mono"
                    />
                    <div className="flex gap-1">
                      <button 
                        onClick={() => data.onPickElement(id, `item_${index}`)}
                        className="p-1.5 hover:bg-cyan-500/20 text-muted-foreground hover:text-cyan-500 rounded transition-colors"
                        title="Вибрати через браузер (ПК)"
                      >
                        <MousePointer size={12} />
                      </button>
                      <button 
                        onClick={() => data.onPickElement?.(id, `item_${index}`)}
                        className="p-1.5 hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-500 rounded transition-colors"
                        title="Вибрати через трансляцію"
                      >
                        <Camera size={12} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeItem(index)}
                      className="p-1.5 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Текст:</span>
                    <select 
                      value={item.condition}
                      onChange={(e) => updateItem(index, 'condition', e.target.value)}
                      className="bg-background border-none p-1 text-[10px] rounded outline-none cursor-pointer"
                    >
                      <option value="contains">Містить</option>
                      <option value="equals">Рівно</option>
                      <option value=">">Більше {'>'}</option>
                      <option value="<">Менше {'<'}</option>
                      <option value="exists">Існує</option>
                    </select>
                    {item.condition !== 'exists' && (
                      <input 
                        type="text"
                        value={item.value}
                        onChange={(e) => updateItem(index, 'value', e.target.value)}
                        className="w-16 bg-background border-none p-1 text-[10px] rounded focus:ring-1 ring-cyan-500 outline-none text-center"
                        placeholder="Значення"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
             <div className="flex justify-between items-center text-[9px]">
                <span className="text-muted-foreground italic">Пошук до першого збігу</span>
                <div className="flex items-center gap-1 text-cyan-500 font-bold">
                   <span>Очікування: {data.timeout || 5000}мс</span>
                </div>
             </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default MultiScanNode;
