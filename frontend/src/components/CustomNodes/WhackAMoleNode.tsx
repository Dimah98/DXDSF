// Нода «Вдарь Крота» — React-компонент для інтерфейсу ноди
// Відображає налаштування: 9 індивідуальних комірок (X, Y, W, H), поріг схожості, інтервал, кнопки завершення
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Hammer, Check, X, Timer, Flag, SlidersHorizontal, LayoutGrid, Camera, MousePointer, Clock, Cpu, Zap, Eye } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

export interface MoleCellConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_CELLS: MoleCellConfig[] = [
  { x: 100, y: 100, w: 100, h: 100 }, // 1 (0,0)
  { x: 220, y: 100, w: 100, h: 100 }, // 2 (0,1)
  { x: 340, y: 100, w: 100, h: 100 }, // 3 (0,2)
  { x: 100, y: 220, w: 100, h: 100 }, // 4 (1,0)
  { x: 220, y: 220, w: 100, h: 100 }, // 5 (1,1)
  { x: 340, y: 220, w: 100, h: 100 }, // 6 (1,2)
  { x: 100, y: 340, w: 100, h: 100 }, // 7 (2,0)
  { x: 220, y: 340, w: 100, h: 100 }, // 8 (2,1)
  { x: 340, y: 340, w: 100, h: 100 }, // 9 (2,2)
];

const WhackAMoleNode = memo(({ id, data }: { id: string; data: any }) => {
  // Статус згортання ноди
  const mini = data.miniCollapsed;
  const engineMode = data.engineMode || 'auto';
  const [selectedCellIndex, setSelectedCellIndex] = useState(0);
  const [showAllCells, setShowAllCells] = useState(false);

  // Отримуємо або ініціалізуємо масив 9 комірок
  const getCells = (): MoleCellConfig[] => {
    if (Array.isArray(data.cells) && data.cells.length === 9) {
      return data.cells;
    }
    if (data.cropW && data.cropH) {
      const cW = Math.floor(data.cropW / 3);
      const cH = Math.floor(data.cropH / 3);
      const cX = data.cropX || 0;
      const cY = data.cropY || 0;
      return [
        { x: cX, y: cY, w: cW, h: cH },
        { x: cX + cW, y: cY, w: cW, h: cH },
        { x: cX + cW * 2, y: cY, w: cW, h: cH },
        { x: cX, y: cY + cH, w: cW, h: cH },
        { x: cX + cW, y: cY + cH, w: cW, h: cH },
        { x: cX + cW * 2, y: cY + cH, w: cW, h: cH },
        { x: cX, y: cY + cH * 2, w: cW, h: cH },
        { x: cX + cW, y: cY + cH * 2, w: cW, h: cH },
        { x: cX + cW * 2, y: cY + cH * 2, w: cW, h: cH },
      ];
    }
    return DEFAULT_CELLS;
  };

  const cells = getCells();

  const updateCell = (index: number, field: keyof MoleCellConfig, val: number) => {
    const current = getCells();
    const next = current.map((c, i) => i === index ? { ...c, [field]: val } : c);
    data.onDataChange(id, { cells: next });
  };

  const applySizeToAll = (w: number, h: number) => {
    const current = getCells();
    const next = current.map(c => ({ ...c, w, h }));
    data.onDataChange(id, { cells: next });
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Hammer size={16} />}
      title={data.label || 'Вдарь Крота'}
      bgColor="bg-amber-600"
      type="whackAMoleNode"
      width="w-72"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#d97706', '20px', mini)}
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
        <div className="p-3 space-y-3">

          {/* ── Вибір рушія виконання ─────────────────────────────── */}
          <div className="p-2 rounded bg-muted/40 border border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Cpu size={12} className="text-amber-500" /> Рушій гри
              </span>
              <select
                value={engineMode}
                onChange={(e) => data.onDataChange(id, { engineMode: e.target.value })}
                className="bg-background/80 border border-border px-1.5 py-0.5 rounded text-[10px] font-medium focus:ring-1 focus:ring-amber-500 outline-none cursor-pointer"
              >
                <option value="auto">⚡ Авто (Phaser + Зір)</option>
                <option value="phaser">🎮 Phaser Hook (Швидкий)</option>
                <option value="vision">👁️ Комп'ютерний зір</option>
              </select>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {engineMode === 'phaser'
                ? "Зчитує кротів з пам'яті Phaser (б'є до цілі на екрані + 300, 1-2 рази торкається зайця як людина)"
                : engineMode === 'vision'
                ? "Аналіз скріншотів через комп'ютерний зір (NCC-шаблони)"
                : "Phaser Hook за наявності з авто-перемиканням на зір"}
            </p>
          </div>

          {/* ── Налаштування Phaser Hook ─────────────────────────── */}
          {engineMode !== 'vision' && (
            <div className="space-y-2 p-2 rounded bg-amber-950/20 border border-amber-500/20">
              <div className="text-[10px] font-bold uppercase text-amber-300 flex items-center gap-1.5">
                <Zap size={11} /> Налаштування Phaser Hook
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground">Реакція (мс)</span>
                  <input
                    type="number"
                    value={data.reactionDelay ?? 50}
                    onChange={(e) => data.onDataChange(id, { reactionDelay: parseInt(e.target.value) || 0 })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                    min={0}
                    max={500}
                    step={10}
                    title="Затримка реакції перед ударом після появи крота"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground">Цільовий рахунок</span>
                  <input
                    type="number"
                    value={data.targetScore ?? 0}
                    onChange={(e) => data.onDataChange(id, { targetScore: parseInt(e.target.value) || 0 })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                    min={0}
                    step={25}
                    placeholder="0 = екран + 300"
                    title="Цільовий рахунок. Якщо 0 — грає автоматично до (ціль на екрані + 300)"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 p-1.5 bg-muted/60 rounded-md cursor-pointer hover:bg-muted/80 transition-colors">
                <input
                  type="checkbox"
                  checked={data.autoStart !== false}
                  onChange={(e) => data.onDataChange(id, { autoStart: e.target.checked })}
                  className="rounded border-border text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[10px] font-medium text-muted-foreground select-none">
                  Авто-натискання кнопки "Start"
                </span>
              </label>
            </div>
          )}

          {/* ── Максимальна тривалість ───────────────────────────── */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
              <Timer size={11} /> Макс. тривалість (с)
            </label>
            <input
              type="number"
              value={(data.maxDuration ?? 60000) / 1000}
              onChange={(e) => data.onDataChange(id, { maxDuration: (parseInt(e.target.value) || 60) * 1000 })}
              className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
              min={5} max={600} step={5}
            />
          </div>

          {/* ── Параметри комп'ютерного зору (Pixel Vision) ──────── */}
          {engineMode !== 'phaser' && (
            <div className="space-y-3 pt-1 border-t border-border">
              {engineMode === 'auto' && (
                <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Eye size={11} /> Комп'ютерний зір (резервний рушій)
                </div>
              )}

              {/* Таймінги */}
              <div className="grid grid-cols-2 gap-2">
                {/* Інтервал перевірки */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Timer size={11} /> Інтервал (мс)
                  </label>
                  <input
                    type="number"
                    value={data.checkInterval ?? 400}
                    onChange={(e) => data.onDataChange(id, { checkInterval: parseInt(e.target.value) || 400 })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                    min={100} max={2000} step={50}
                  />
                </div>

                {/* Затримка кліку */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Timer size={11} /> Клік (мс)
                  </label>
                  <input
                    type="number"
                    value={data.clickDelay ?? 150}
                    onChange={(e) => data.onDataChange(id, { clickDelay: parseInt(e.target.value) || 150 })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                    min={50} max={1000} step={50}
                  />
                </div>
              </div>

              {/* Поріг схожості NCC */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <SlidersHorizontal size={11} /> Поріг NCC (0-1)
                </label>
                <input
                  type="number"
                  value={data.matchThreshold ?? 0.72}
                  onChange={(e) => data.onDataChange(id, { matchThreshold: parseFloat(e.target.value) || 0.72 })}
                  className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                  min={0.3} max={0.99} step={0.01}
                />
              </div>

              {/* Тип кліку, Кулдаун та Фото-дебаг */}
              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <MousePointer size={11} className="text-amber-500" /> Тип кліку
                  </label>
                  <select
                    value={data.clickType ?? 'human'}
                    onChange={(e) => data.onDataChange(id, { clickType: e.target.value })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-medium text-foreground cursor-pointer"
                  >
                    <option value="human">🖱️ Human (Людиноподібний рух і таймінг)</option>
                    <option value="touch">📱 Touch (Сенсорний тап без курсору)</option>
                    <option value="pointer">🎯 Pointer (Canvas PointerEvent)</option>
                    <option value="fast">⚡ Fast (Прямий швидкий клік)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Кулдаун на комірки */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1" title="Час блокування повторного удару по одній норі">
                      <Clock size={11} className="text-amber-500" /> Кулдаун нори (мс)
                    </label>
                    <input
                      type="number"
                      value={data.cellCooldown ?? 800}
                      onChange={(e) => data.onDataChange(id, { cellCooldown: parseInt(e.target.value) || 0 })}
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                      min={0} max={5000} step={50}
                      placeholder="800"
                    />
                  </div>

                  {/* Перемикач фото-дебагу */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Camera size={11} className="text-amber-500" /> Фото дебаг
                    </label>
                    <label className="flex items-center gap-2 p-1.5 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors h-[29px]">
                      <input
                        type="checkbox"
                        checked={data.photoDebug === true}
                        onChange={(e) => data.onDataChange(id, { photoDebug: e.target.checked })}
                        className="rounded border-border text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[10px] font-medium text-muted-foreground select-none">
                        {data.photoDebug === true ? 'Увімкнено' : 'Вимкнено'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Налаштування 9 комірок (3×3) */}
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <LayoutGrid size={12} className="text-amber-500" /> 9 комірок (3×3)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAllCells(!showAllCells)}
                    className="text-[9px] text-amber-500 hover:text-amber-400 font-medium transition-colors"
                  >
                    {showAllCells ? 'Згорнути' : 'Показати всі 9'}
                  </button>
                </div>

                {/* 3×3 Інтерактивний вибір комірки */}
                <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-muted/40 rounded-lg border border-border/50">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                    const isSel = selectedCellIndex === idx;
                    const r = Math.floor(idx / 3);
                    const c = idx % 3;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedCellIndex(idx)}
                        className={`py-1.5 px-2 text-[10px] font-mono font-bold rounded flex flex-col items-center justify-center transition-all ${
                          isSel
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                            : 'bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>#{idx + 1}</span>
                        <span className="text-[8px] opacity-75 font-normal">({r},{c})</span>
                      </button>
                    );
                  })}
                </div>

                {!showAllCells ? (
                  // Індивідуальні інпути для вибраної комірки
                  <div className="p-2.5 bg-muted/30 rounded-lg border border-border/50 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-500">
                        Комірка #{selectedCellIndex + 1} ({Math.floor(selectedCellIndex / 3)},{selectedCellIndex % 3})
                      </span>
                      <button
                        type="button"
                        onClick={() => applySizeToAll(cells[selectedCellIndex].w, cells[selectedCellIndex].h)}
                        className="text-[8px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 transition-colors"
                        title="Застосувати W і H цієї комірки до всіх 9 комірок"
                      >
                        W/H для всіх 9
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Позиція X</span>
                        <input
                          type="number"
                          value={cells[selectedCellIndex]?.x ?? 0}
                          onChange={(e) => updateCell(selectedCellIndex, 'x', parseInt(e.target.value) || 0)}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Позиція Y</span>
                        <input
                          type="number"
                          value={cells[selectedCellIndex]?.y ?? 0}
                          onChange={(e) => updateCell(selectedCellIndex, 'y', parseInt(e.target.value) || 0)}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                          min={0}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Ширина W</span>
                        <input
                          type="number"
                          value={cells[selectedCellIndex]?.w ?? 100}
                          onChange={(e) => updateCell(selectedCellIndex, 'w', parseInt(e.target.value) || 100)}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                          min={20}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Висота H</span>
                        <input
                          type="number"
                          value={cells[selectedCellIndex]?.h ?? 100}
                          onChange={(e) => updateCell(selectedCellIndex, 'h', parseInt(e.target.value) || 100)}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                          min={20}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Всі 9 комірок компактно
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {cells.map((cell, idx) => (
                      <div
                        key={idx}
                        className={`p-1.5 rounded border text-xs ${
                          selectedCellIndex === idx
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-muted/40 border-border/60'
                        }`}
                        onClick={() => setSelectedCellIndex(idx)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[10px] text-amber-400">
                            #{idx + 1} ({Math.floor(idx / 3)},{idx % 3})
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <div>
                            <span className="text-[8px] text-muted-foreground">X</span>
                            <input
                              type="number"
                              value={cell.x}
                              onChange={(e) => updateCell(idx, 'x', parseInt(e.target.value) || 0)}
                              className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] text-muted-foreground">Y</span>
                            <input
                              type="number"
                              value={cell.y}
                              onChange={(e) => updateCell(idx, 'y', parseInt(e.target.value) || 0)}
                              className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] text-muted-foreground">W</span>
                            <input
                              type="number"
                              value={cell.w}
                              onChange={(e) => updateCell(idx, 'w', parseInt(e.target.value) || 100)}
                              className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] text-muted-foreground">H</span>
                            <input
                              type="number"
                              value={cell.h}
                              onChange={(e) => updateCell(idx, 'h', parseInt(e.target.value) || 100)}
                              className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Кнопки завершення ─────────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Flag size={12} /> Кнопки завершення
            </label>
            <textarea
              value={data.exitButtonTexts ?? ''}
              onChange={(e) => data.onDataChange(id, { exitButtonTexts: e.target.value })}
              placeholder={"Сбір нагороди\nStart\nbutton:has-text(\"Далі\")"}
              rows={3}
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none resize-none font-mono"
            />
            <p className="text-[9px] text-muted-foreground">
              Кожен варіант — новий рядок. Можна текст або CSS-селектор.
            </p>
          </div>

          {/* ── Підписи портів ────────────────────────────────────── */}
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase">
              <Check size={10} /> Успішно
            </div>
            <div className="flex items-center gap-1 text-[9px] font-bold text-red-500 uppercase">
              Помилка <X size={10} />
            </div>
          </div>

        </div>
      )}
    </BaseNode>
  );
});

export default WhackAMoleNode;
