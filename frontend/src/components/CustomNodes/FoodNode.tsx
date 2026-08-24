import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Apple, MousePointer } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';
import { Input } from '../ui/input';

const OUT_PORTS = [
  { id: 'success', color: '#22c55e', label: '✅ З\'їдено', top: '135px' },
  { id: 'skip',    color: '#3b82f6', label: '⏭️ Нічого не знайдено', top: '160px' },
];

const FoodNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Apple size={16} />}
      title="Їжа"
      bgColor="#f59e0b"
      type="foodNode"
      width="w-72"
    >
      {/* Вхід */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={getHandleStyle('#f59e0b', '20px', mini)}
        className="!left-[-6px]"
      />

      {/* Виходи — завжди в DOM */}
      {OUT_PORTS.map(p => (
        <Handle
          key={p.id}
          type="source"
          position={Position.Right}
          id={p.id}
          style={getHandleStyle(p.color, mini ? '50%' : p.top, mini)}
          className="!right-[-6px]"
        />
      ))}

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Поле CSS-селектора кнопки "з'їсти" */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-amber-300 uppercase">
              CSS-селектор кнопки "з'їсти"
            </label>
            <div className="flex gap-1">
              <Input
                value={data.eatButtonSelector || ''}
                onChange={(e) => data.onDataChange?.(id, { eatButtonSelector: e.target.value })}
                placeholder=".eat-button, button[data-action='eat']"
                className="h-7 text-[10px] border-border bg-muted text-muted-foreground font-mono"
              />
              <button
                onClick={() => data.onPickElement?.(id, 'eatButtonSelector')}
                className="p-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 rounded-md transition-colors shrink-0"
                title="Вибрати у браузері"
              >
                <MousePointer size={13} />
              </button>
            </div>
          </div>

          {/* Підказка про глобальні налаштування */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
            <p className="text-[9px] text-amber-300/80 leading-relaxed">
              🍎 Предмети їжі налаштовуються у <span className="font-bold text-amber-300">Глобальних Налаштуваннях → Їжа</span>.
              Відмітьте предмети та вкажіть назви їх зображень.
            </p>
          </div>

          {/* Підписи портів */}
          <div className="space-y-1 border-t border-border pt-2">
            {OUT_PORTS.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-end gap-1.5 text-[9px]"
                style={{ color: p.color }}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                {p.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default FoodNode;
