// Нода «Порятунок Кур» (ChickenRescueNode) — React-компонент для візуального редактора
// Керування параметрами автопілота гри-змійки Chicken Rescue у Sunflower Land

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Egg, Trophy, Timer, RotateCcw, Zap, ShieldAlert, Cpu } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const ChickenRescueNode = memo(({ id, data }: { id: string; data: any }) => {
  const mini = data.miniCollapsed;
  const engineMode = data.engineMode || 'phaser';
  const targetScore = typeof data.targetScore === 'number' ? data.targetScore : 40;
  const autoStart = data.autoStart !== false;
  const retryOnDeath = data.retryOnDeath !== false;
  const maxRetries = typeof data.maxRetries === 'number' ? data.maxRetries : 3;
  const maxDuration = typeof data.maxDuration === 'number' ? data.maxDuration : 120000;
  const browserDebug = data.browserDebug !== false;

  const update = (patch: Record<string, any>) => {
    if (typeof data.onDataChange === 'function') {
      data.onDataChange(id, patch);
    }
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Egg size={16} />}
      title={data.label || 'Порятунок Кур'}
      bgColor="bg-amber-600"
      type="chickenRescueNode"
      width="w-72"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#eab308', '20px', mini)}
        className="!left-[-6px]"
      />
      {/* Вихід: успішно */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={getHandleStyle('#22c55e', mini ? '50%' : '35%', mini)}
        className="!right-[-6px]"
      />
      {/* Вихід: помилка */}
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={getHandleStyle('#ef4444', mini ? '50%' : '65%', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3 text-xs text-gray-200">
          {/* Режим рушія */}
          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 flex items-center gap-1">
              <Cpu size={12} className="text-amber-400" />
              Режим рушія
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-950/60 rounded-lg border border-gray-800">
              <button
                type="button"
                onClick={() => update({ engineMode: 'phaser' })}
                className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
                  engineMode === 'phaser'
                    ? 'bg-amber-500 text-black font-semibold shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Zap size={11} />
                Phaser Hook
              </button>
              <button
                type="button"
                onClick={() => update({ engineMode: 'auto' })}
                className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
                  engineMode === 'auto'
                    ? 'bg-amber-500 text-black font-semibold shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                ⚡ Авто
              </button>
            </div>
          </div>

          {/* Цільовий рахунок */}
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-gray-300 flex items-center gap-1 font-medium">
                <Trophy size={13} className="text-yellow-400" />
                Ціль курей (Score)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={targetScore}
                onChange={e => update({ targetScore: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-16 px-1.5 py-0.5 text-right font-mono bg-gray-950 border border-gray-700 rounded text-amber-300 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-[10px] text-gray-400 leading-tight">
              Кількість врятованих курей для завершення ноди (за замовчуванням 40).
            </div>
          </div>

          {/* Параметри автопілота */}
          <div className="bg-gray-900/40 p-2.5 rounded-lg border border-gray-800/80 space-y-2">
            <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
              <ShieldAlert size={12} />
              Налаштування автопілота
            </div>

            {/* Автостарт */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300">Автоматичний старт / рестарт</span>
              <input
                type="checkbox"
                checked={autoStart}
                onChange={e => update({ autoStart: e.target.checked })}
                className="rounded bg-gray-950 border-gray-700 text-amber-500 focus:ring-amber-400"
              />
            </label>

            {/* Оверлей у браузері (60 FPS) */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300 flex items-center gap-1">
                <Zap size={11} className="text-amber-400" />
                Оверлей у браузері (60 FPS)
              </span>
              <input
                type="checkbox"
                checked={browserDebug}
                onChange={e => update({ browserDebug: e.target.checked })}
                className="rounded bg-gray-950 border-gray-700 text-amber-500 focus:ring-amber-400"
              />
            </label>

            {/* Перезапуск при загибелі */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-300">Повторювати при зіткненні</span>
              <input
                type="checkbox"
                checked={retryOnDeath}
                onChange={e => update({ retryOnDeath: e.target.checked })}
                className="rounded bg-gray-950 border-gray-700 text-amber-500 focus:ring-amber-400"
              />
            </label>

            {retryOnDeath && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                  <RotateCcw size={11} /> Макс. спроб:
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxRetries}
                  onChange={e => update({ maxRetries: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-14 px-1.5 py-0.5 text-right font-mono bg-gray-950 border border-gray-700 rounded text-gray-200"
                />
              </div>
            )}

            {/* Ліміт часу */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-800">
              <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                <Timer size={11} /> Макс. час (с):
              </span>
              <input
                type="number"
                min={10}
                max={600}
                value={Math.round(maxDuration / 1000)}
                onChange={e => update({ maxDuration: Math.max(10000, (parseInt(e.target.value, 10) || 10) * 1000) })}
                className="w-14 px-1.5 py-0.5 text-right font-mono bg-gray-950 border border-gray-700 rounded text-gray-200"
              />
            </div>
          </div>

          {/* Особливості режиму */}
          <div className="p-2 rounded bg-amber-950/20 border border-amber-800/30 text-[10px] text-amber-300/80 leading-relaxed">
            <span className="font-semibold text-amber-300">⚡ 60 FPS Автопілот:</span> точне зчитування фізичних тіл перешкод, дистанціювання від гоблінів, BFS-пошук найближчої курки та Flood Fill захист від застрягання у глухих кутах.
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default ChickenRescueNode;
