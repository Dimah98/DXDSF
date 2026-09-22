// Нода «Капча (Quick Check)» (CaptchaNode) — React-компонент для візуального редактора
// Автоматичне проходження капчі перетягування культури в силует (Sunflower Land)

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Puzzle, ShieldCheck, CheckCircle2, FastForward, AlertTriangle, Timer, MousePointer } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const CaptchaNode = memo(({ id, data }: { id: string; data: any }) => {
  const mini = data.miniCollapsed;
  const skipIfNotFound = data.skipIfNotFound !== false;
  const timeout = typeof data.timeout === 'number' ? data.timeout : 5000;
  const dragDurationMs = typeof data.dragDurationMs === 'number' ? data.dragDurationMs : 400;
  const autoClickContinue = data.autoClickContinue !== false;
  const maxRetries = typeof data.maxRetries === 'number' ? data.maxRetries : 2;

  const update = (patch: Record<string, any>) => {
    if (typeof data.onDataChange === 'function') {
      data.onDataChange(id, patch);
    }
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Puzzle size={16} />}
      title={data.label || 'Капча (Quick Check)'}
      bgColor="bg-orange-600"
      type="captchaSolverNode"
      width="w-72"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#f97316', '20px', mini)}
        className="!left-[-6px]"
      />
      {/* Вихід: розв'язано */}
      <Handle
        type="source"
        position={Position.Right}
        id="solved"
        style={getHandleStyle('#22c55e', mini ? '50%' : '28%', mini)}
        className="!right-[-6px]"
      />
      {/* Вихід: пропущено (капчі не було) */}
      <Handle
        type="source"
        position={Position.Right}
        id="skipped"
        style={getHandleStyle('#3b82f6', mini ? '50%' : '50%', mini)}
        className="!right-[-6px]"
      />
      {/* Вихід: помилка */}
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={getHandleStyle('#ef4444', mini ? '50%' : '72%', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3 text-xs text-gray-200">
          {/* Режим пропуску */}
          <div className="flex items-center justify-between p-2 rounded bg-gray-900 border border-gray-800">
            <span className="text-[11px] text-gray-300 flex items-center gap-1.5">
              <FastForward size={13} className="text-blue-400" />
              Пропускати якщо немає
            </span>
            <input
              type="checkbox"
              checked={skipIfNotFound}
              onChange={e => update({ skipIfNotFound: e.target.checked })}
              className="rounded bg-gray-950 border-gray-700 text-orange-500 focus:ring-orange-400"
            />
          </div>

          {!skipIfNotFound && (
            <div className="flex items-center justify-between p-2 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-400 flex items-center gap-1.5 text-[11px]">
                <Timer size={13} className="text-amber-400" />
                Очікування капчі (с):
              </span>
              <input
                type="number"
                min={1}
                max={60}
                value={Math.round(timeout / 1000)}
                onChange={e => update({ timeout: Math.max(1000, (parseInt(e.target.value, 10) || 5) * 1000) })}
                className="w-14 px-1.5 py-0.5 text-right font-mono bg-gray-950 border border-gray-700 rounded text-gray-200"
              />
            </div>
          )}

          {/* Автоматичне натискання кнопки Continue */}
          <div className="flex items-center justify-between p-2 rounded bg-gray-900 border border-gray-800">
            <span className="text-[11px] text-gray-300 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              Клікати «Continue»
            </span>
            <input
              type="checkbox"
              checked={autoClickContinue}
              onChange={e => update({ autoClickContinue: e.target.checked })}
              className="rounded bg-gray-950 border-gray-700 text-orange-500 focus:ring-orange-400"
            />
          </div>

          {/* Параметри перетягування */}
          <div className="p-2 space-y-2 rounded bg-gray-900 border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5 text-[11px]">
                <MousePointer size={13} className="text-orange-400" />
                Час перетягування:
              </span>
              <span className="font-mono text-gray-300">{dragDurationMs} мс</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5 text-[11px]">
                <ShieldCheck size={13} className="text-purple-400" />
                Спроб розв'язання:
              </span>
              <input
                type="number"
                min={1}
                max={5}
                value={maxRetries}
                onChange={e => update({ maxRetries: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-14 px-1.5 py-0.5 text-right font-mono bg-gray-950 border border-gray-700 rounded text-gray-200"
              />
            </div>
          </div>

          {/* Виходи (легенда) */}
          <div className="pt-1 border-t border-gray-800 flex justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1 text-emerald-400">● Розв'язано</span>
            <span className="flex items-center gap-1 text-blue-400">● Пропуск</span>
            <span className="flex items-center gap-1 text-rose-400">● Помилка</span>
          </div>

          {/* Підказка */}
          <div className="p-2 rounded bg-orange-950/20 border border-orange-800/30 text-[10px] text-orange-300/80 leading-relaxed">
            <span className="font-semibold text-orange-300">🧩 Dual Captcha Solver:</span> автоматично проходить обидва види капчі (Drag & Drop пазл або Rotate обертання предмета) та клікає Continue.
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CaptchaNode;
