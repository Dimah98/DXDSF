// Нода Монітор Змінних — відображає всі глобальні змінні проекту в реальному часі
// Дозволяє видаляти і перетягувати змінні для зміни порядку
import { memo, useState, useRef } from 'react';
import { Database, Activity, Trash2, GripVertical } from 'lucide-react';
import BaseNode from './BaseNode';

const VariablesMonitorNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const variables: Record<string, any> = data.globalVariables || {};
  const varKeys = Object.keys(variables);

  // Стан для порядку ключів (drag-and-drop)
  const [order, setOrder] = useState<string[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  // Визначаємо актуальний порядок
  const displayKeys = order.length > 0
    ? [...order.filter(k => varKeys.includes(k)), ...varKeys.filter(k => !order.includes(k))]
    : varKeys;

  // Безпечне відображення значення
  const renderValue = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') {
      try { return JSON.stringify(val).substring(0, 30) + '...'; } catch { return '[Object]'; }
    }
    if (typeof val === 'number') return val.toLocaleString('uk-UA');
    return String(val);
  };

  // Видалити змінну глобально
  const handleDelete = (key: string) => {
    data.onUpdateVariable?.(key, undefined); // undefined = видалити
    setOrder(prev => prev.filter(k => k !== key));
  };

  // Drag-and-drop handlers
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOver.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const newOrder = [...displayKeys];
    const dragged = newOrder.splice(dragItem.current, 1)[0];
    newOrder.splice(dragOver.current, 0, dragged);
    setOrder(newOrder);
    dragItem.current = null;
    dragOver.current = null;
  };

  return (
    <BaseNode id={id} data={data} icon={<Activity size={16} />} title="Монітор Змінних" bgColor="bg-emerald-600" type="variablesMonitorNode" width="w-72">
      {!mini && (
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
              <Database size={10} /> Глобальна База
            </span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full font-mono">
              {varKeys.length} шт.
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 pr-1">
            {displayKeys.length === 0 ? (
              <div className="text-[10px] text-muted-foreground italic text-center py-4 bg-muted/20 rounded-lg border border-dashed border-border">
                Змінних поки немає...
              </div>
            ) : (
              displayKeys.map((key, index) => (
                <div
                  key={key}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex items-center justify-between p-2 rounded bg-[#0f172a] border border-emerald-500/10 hover:border-emerald-500/30 transition-colors group cursor-default"
                >
                  {/* Ручка для перетягування */}
                  <div className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground mr-1">
                    <GripVertical size={12} />
                  </div>

                  {/* Назва змінної */}
                  <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                    <div className="w-1 h-4 bg-emerald-500/40 rounded-full group-hover:bg-emerald-500 transition-colors shrink-0" />
                    <span className="text-[10px] font-bold text-slate-300 truncate font-mono">{key}</span>
                  </div>

                  {/* Значення */}
                  <span className="text-[11px] font-bold text-emerald-400 font-mono ml-2 shrink-0 max-w-[80px] truncate">
                    {renderValue(variables[key])}
                  </span>

                  {/* Кнопка видалення */}
                  <button
                    onClick={() => handleDelete(key)}
                    className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400 shrink-0"
                    title="Видалити змінну"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default VariablesMonitorNode;
