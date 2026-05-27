// Нода зсуву координат — додає offsetX/offsetY до вхідних координат
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Move, ArrowRight, XCircle } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const CoordOffsetNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;

  return (
    <BaseNode id={id} data={data} icon={<Move size={16} />} title="Зсув" bgColor="bg-indigo-600" type="coordOffsetNode">
      {/* Вхідний порт — ЗАВЖДИ в DOM */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#4f46e5', '20px', mini)} className="!left-[-6px]" />

      {/* Вихідні порти — ЗАВЖДИ в DOM (різні позиції залежно від стану) */}
      <Handle type="source" position={Position.Right} id="pass"
        style={getHandleStyle('#10b981', mini ? '50%' : '80px', mini)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="fail"
        style={getHandleStyle('#f43f5e', mini ? '50%' : '130px', mini)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="coords"
        style={getHandleStyle('#3b82f6', mini ? '50%' : '180px', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Поля зсуву */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-muted-foreground">Зсув X</label>
              <Input
                type="number"
                value={data.offsetX || 0}
                onChange={(e) => data.onDataChange?.(id, { offsetX: e.target.value })}
                className="h-7 text-[10px] border-border bg-muted text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-muted-foreground">Зсув Y</label>
              <Input
                type="number"
                value={data.offsetY || 0}
                onChange={(e) => data.onDataChange?.(id, { offsetY: e.target.value })}
                className="h-7 text-[10px] border-border bg-muted text-foreground"
              />
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground/70 italic">
            Додає зсув (px) до вхідних координат
          </p>

          {/* Підписи портів виходу */}
          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-emerald-400">
              Успіх <ArrowRight size={10} />
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-rose-400">
              Помилка <XCircle size={10} />
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-blue-400">
              Координати <ArrowRight size={10} />
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CoordOffsetNode;
