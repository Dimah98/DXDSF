// UI компонент ноди випадкової затримки (антидетект)
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Timer } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';
import { Input } from '../ui/input';

const RandomDelayNode = memo(({ id, data }: any) => {
  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Timer size={16} />}
      title="Рандом-Пауза"
      bgColor="bg-indigo-500"
      type="randomDelayNode"
      width="w-56"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#6366f1', '20px', data.miniCollapsed)}
        className="!left-[-6px]"
      />
      {/* Вихідний порт */}
      <Handle
        type="source"
        position={Position.Right}
        style={getHandleStyle('#475569', '20px', data.miniCollapsed)}
        className="!right-[-6px]"
      />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          {/* Мінімальна затримка */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0 w-8">Від</span>
            <Input
              type="number"
              value={data.minDelay ?? 500}
              min={0}
              onChange={(e) =>
                data.onDataChange &&
                data.onDataChange(id, { minDelay: parseInt(e.target.value) || 0 })
              }
              className="h-7 text-[11px] border-border bg-muted text-muted-foreground"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">мс</span>
          </div>

          {/* Максимальна затримка */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0 w-8">До</span>
            <Input
              type="number"
              value={data.maxDelay ?? 2000}
              min={0}
              onChange={(e) =>
                data.onDataChange &&
                data.onDataChange(id, { maxDelay: parseInt(e.target.value) || 0 })
              }
              className="h-7 text-[11px] border-border bg-muted text-muted-foreground"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">мс</span>
          </div>

          {/* Остання затримка (відображається після виконання) */}
          {data.lastDelay && (
            <div className="text-center text-[10px] text-indigo-400 font-mono bg-indigo-500/10 rounded-md py-1 border border-indigo-500/20">
              Остання: <strong>{data.lastDelay}</strong>
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
});

export default RandomDelayNode;
