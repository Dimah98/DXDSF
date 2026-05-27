// Нода Чергувач — по черзі або рандомно направляє сигнал у різні виходи
import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Shuffle, ArrowRightLeft, Plus, Minus } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#a855f7', '#0891b2', '#f43f5e', '#10b981',
];

const RotatorNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  // Кількість виходів (мінімум 2, максимум 8)
  const outputCount: number = Math.max(2, Math.min(8, data.outputCount || 2));
  // Режим: 'sequence' (по черзі) або 'random'
  const mode: string = data.mode || 'sequence';
  const updateNodeInternals = useUpdateNodeInternals();

  // Оновлюємо позиції handles коли міняється кількість виходів
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputCount, mini, updateNodeInternals]);

  const setOutputCount = (n: number) => {
    data.onDataChange(id, { outputCount: Math.max(2, Math.min(8, n)) });
  };

  const toggleMode = () => {
    data.onDataChange(id, { mode: mode === 'sequence' ? 'random' : 'sequence' });
  };

  // Висота: заголовок ~36px + padding + рядки виходів ~28px кожен
  const bodyTopOffset = 48; // від верху ноди до початку тіла
  const rowHeight = 28;

  return (
    <BaseNode
      id={id}
      data={data}
      icon={mode === 'random' ? <Shuffle size={16} /> : <ArrowRightLeft size={16} />}
      title="Чергувач"
      bgColor="bg-violet-600"
      type="rotatorNode"
      width="w-52"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={getHandleStyle('#7c3aed', '20px', mini)}
        className="!left-[-6px]"
      />

      {/* Вихідні порти — по одному на кожен вихід */}
      {Array.from({ length: outputCount }).map((_, i) => {
        const topPx = mini ? '50%' : `${bodyTopOffset + i * rowHeight}px`;
        return (
          <Handle
            key={`out_${i}`}
            type="source"
            position={Position.Right}
            id={`out_${i}`}
            style={getHandleStyle(COLORS[i % COLORS.length], topPx, mini)}
            className="!right-[-6px]"
          />
        );
      })}

      {!mini && (
        <div className="p-2 space-y-1">
          {/* Кнопки +/- для кількості виходів */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground uppercase font-bold">
              Виходів:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOutputCount(outputCount - 1)}
                disabled={outputCount <= 2}
                className="w-5 h-5 rounded bg-muted/50 hover:bg-accent/30 text-muted-foreground disabled:opacity-30 flex items-center justify-center"
              >
                <Minus size={10} />
              </button>
              <span className="text-[11px] font-bold font-mono w-4 text-center text-violet-400">
                {outputCount}
              </span>
              <button
                onClick={() => setOutputCount(outputCount + 1)}
                disabled={outputCount >= 8}
                className="w-5 h-5 rounded bg-muted/50 hover:bg-accent/30 text-muted-foreground disabled:opacity-30 flex items-center justify-center"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>

          {/* Список виходів */}
          <div className="space-y-0.5">
            {Array.from({ length: outputCount }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 rounded"
                style={{ backgroundColor: `${COLORS[i % COLORS.length]}15` }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-[10px] font-mono text-slate-300">
                  Вихід {i + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Перемикач режиму */}
          <button
            onClick={toggleMode}
            className={`w-full mt-2 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-colors
              ${mode === 'random'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30'
              }`}
          >
            {mode === 'random'
              ? <><Shuffle size={11} /> Рандом</>
              : <><ArrowRightLeft size={11} /> По черзі</>
            }
          </button>
        </div>
      )}
    </BaseNode>
  );
});

export default RotatorNode;
