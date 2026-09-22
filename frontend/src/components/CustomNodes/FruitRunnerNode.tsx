// Нода «Фруктовий Ранер» v2 — React-компонент для інтерфейсу ноди
// Спрощений інтерфейс: менше ручних налаштувань, більше автоматики
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trophy, Timer, ShieldAlert, SlidersHorizontal, Gamepad2, Camera, Rows3, Zap } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const FruitRunnerNode = memo(({ id, data }: { id: string; data: any }) => {
  const mini = data.miniCollapsed;
  const targetScore = data.targetScore !== undefined ? data.targetScore : 2500;
  const maxDuration = data.maxDuration !== undefined ? data.maxDuration : 120000;
  const dangerLookahead = data.dangerLookahead !== undefined ? data.dangerLookahead : 400;
  const safetyMargin = data.safetyMargin !== undefined ? data.safetyMargin : 30;
  const snapshotInterval = data.snapshotInterval !== undefined ? data.snapshotInterval : 500;
  const numLanes = data.numLanes !== undefined ? data.numLanes : 5;
  const gameAreaSelector = data.gameAreaSelector || 'canvas';
  const manualRoadLeft = data.manualRoadLeft !== undefined ? data.manualRoadLeft : 0;
  const manualRoadRight = data.manualRoadRight !== undefined ? data.manualRoadRight : 0;
  const playerFrameTop = data.playerFrameTop !== undefined ? data.playerFrameTop : 0;
  const playerFrameBottom = data.playerFrameBottom !== undefined ? data.playerFrameBottom : 0;
  const detectionTopY = data.detectionTopY !== undefined ? data.detectionTopY : 0;
  const detectionBottomY = data.detectionBottomY !== undefined ? data.detectionBottomY : 0;
  const enableDebugSnapshot = data.enableDebugSnapshot !== undefined ? data.enableDebugSnapshot : true;
  const browserDebug = data.browserDebug !== undefined ? data.browserDebug : false;
  const engineMode = data.engineMode || 'auto';

  const update = (patch: Record<string, any>) => {
    if (typeof data.onDataChange === 'function') {
      data.onDataChange(id, patch);
    }
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Gamepad2 size={16} />}
      title={data.label || 'Фруктовий Ранер'}
      bgColor="bg-emerald-600"
      type="fruitRunnerNode"
      width="w-72"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#10b981', '20px', mini)}
        className="!left-[-6px]"
      />

      {/* Вихідні порти */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={getHandleStyle('#22c55e', '20px', mini)}
        className="!right-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="failed"
        style={getHandleStyle('#ef4444', mini ? '20px' : '45px', mini)}
        className="!right-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="timeout"
        style={getHandleStyle('#f59e0b', mini ? '20px' : '70px', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="space-y-2.5 text-xs text-foreground p-1">
          {/* Цільові очки */}
          <div className="bg-card/60 p-2 rounded border border-border/50">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                <Trophy size={13} />
                Цільові очки (Score):
              </span>
              <input
                type="number"
                value={targetScore}
                onChange={(e) => update({ targetScore: parseInt(e.target.value, 10) || 0 })}
                className="w-20 bg-background/80 border border-border px-1.5 py-0.5 rounded text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Режим рушія (Engine Mode) */}
          <div className="bg-card/60 p-2 rounded border border-emerald-500/30">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                <Zap size={13} />
                Режим рушія:
              </span>
              <select
                value={engineMode}
                onChange={(e) => update({ engineMode: e.target.value })}
                className="bg-background/80 border border-border px-1.5 py-0.5 rounded text-[10px] font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                <option value="auto">⚡ Авто (Phaser + Зір)</option>
                <option value="phaser">🎮 Phaser Hook (60 FPS)</option>
                <option value="vision">👁️ Комп'ютерний зір</option>
              </select>
            </div>
          </div>

          {/* Максимальний час гри */}
          <div className="bg-card/60 p-2 rounded border border-border/50">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <Timer size={13} />
                Ліміт часу (сек):
              </span>
              <input
                type="number"
                value={Math.round(maxDuration / 1000)}
                onChange={(e) => update({ maxDuration: (parseInt(e.target.value, 10) || 1) * 1000 })}
                className="w-20 bg-background/80 border border-border px-1.5 py-0.5 rounded text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Параметри зору та ухиляння */}
          <div className="bg-card/60 p-2 rounded border border-border/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <ShieldAlert size={13} />
                Горизонт захисту (px):
              </span>
              <input
                type="number"
                value={dangerLookahead}
                onChange={(e) => update({ dangerLookahead: parseInt(e.target.value, 10) || 200 })}
                className="w-16 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <SlidersHorizontal size={13} />
                Буфер безпеки (px):
              </span>
              <input
                type="number"
                value={safetyMargin}
                onChange={(e) => update({ safetyMargin: parseInt(e.target.value, 10) || 10 })}
                className="w-16 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <Rows3 size={13} />
                Кількість смуг:
              </span>
              <input
                type="number"
                min="3"
                max="9"
                value={numLanes}
                onChange={(e) => update({ numLanes: Math.max(3, Math.min(9, parseInt(e.target.value, 10) || 5)) })}
                className="w-16 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Фотодебаг (HUD) + Браузерний дебаг */}
          <div className="bg-card/60 p-2 rounded border border-border/50 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-muted-foreground text-[11px] cursor-pointer select-none">
                <Camera size={13} />
                Фотодебаг (HUD):
              </label>
              <input
                type="checkbox"
                checked={enableDebugSnapshot}
                onChange={(e) => update({ enableDebugSnapshot: e.target.checked })}
                className="rounded border-border bg-background text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
              />
            </div>

            {enableDebugSnapshot && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <span className="text-muted-foreground text-[10px]">
                  Інтервал (сек):
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0.2"
                  value={Math.round((snapshotInterval / 1000) * 10) / 10}
                  onChange={(e) => update({ snapshotInterval: Math.max(200, Math.round((parseFloat(e.target.value) || 0.5) * 1000)) })}
                  className="w-16 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
              <label className="flex items-center gap-1.5 text-cyan-400 text-[11px] cursor-pointer select-none font-semibold">
                <Zap size={13} />
                Оверлей в браузері (60fps):
              </label>
              <input
                type="checkbox"
                checked={browserDebug}
                onChange={(e) => update({ browserDebug: e.target.checked })}
                className="rounded border-border bg-background text-cyan-400 focus:ring-cyan-400 h-4 w-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Canvas селектор (Advanced) */}
          <div className="bg-card/60 p-2 rounded border border-border/50">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <Gamepad2 size={13} />
                Canvas селектор:
              </span>
              <input
                type="text"
                value={gameAreaSelector}
                onChange={(e) => update({ gameAreaSelector: e.target.value || 'canvas' })}
                className="w-24 bg-background/80 border border-border px-1.5 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="canvas"
              />
            </div>
          </div>

          {/* Ручні межі (0 = авто) */}
          <div className="bg-card/60 p-2 rounded border border-amber-500/30 space-y-1.5">
            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">📏 Ручні межі (0 = авто)</span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground text-[10px]">Дорога ←</span>
                <input type="number" value={manualRoadLeft} onChange={(e) => update({ manualRoadLeft: parseInt(e.target.value, 10) || 0 })}
                  className="w-14 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground text-[10px]">Дорога →</span>
                <input type="number" value={manualRoadRight} onChange={(e) => update({ manualRoadRight: parseInt(e.target.value, 10) || 0 })}
                  className="w-14 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground text-[10px]">Герой ↑</span>
                <input type="number" value={playerFrameTop} onChange={(e) => update({ playerFrameTop: parseInt(e.target.value, 10) || 0 })}
                  className="w-14 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground text-[10px]">Герой ↓</span>
                <input type="number" value={playerFrameBottom} onChange={(e) => update({ playerFrameBottom: parseInt(e.target.value, 10) || 0 })}
                  className="w-14 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground text-[10px]">Детекція Y ↑</span>
                <input type="number" value={detectionTopY} onChange={(e) => update({ detectionTopY: parseInt(e.target.value, 10) || 0 })}
                  className="w-14 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground text-[10px]">Детекція Y ↓</span>
                <input type="number" value={detectionBottomY} onChange={(e) => update({ detectionBottomY: parseInt(e.target.value, 10) || 0 })}
                  className="w-14 bg-background/80 border border-border px-1 py-0.5 rounded text-right font-mono text-[10px] focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Легенда виходів */}
          <div className="text-[10px] space-y-0.5 pt-1 border-t border-border/40 text-muted-foreground">
            <div className="flex items-center justify-between text-green-400">
              <span>● success</span>
              <span>Ціль досягнуто ({targetScore})</span>
            </div>
            <div className="flex items-center justify-between text-red-400">
              <span>● failed</span>
              <span>Game Over / поразка</span>
            </div>
            <div className="flex items-center justify-between text-amber-400">
              <span>● timeout</span>
              <span>Вичерпано ліміт часу</span>
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default FruitRunnerNode;
