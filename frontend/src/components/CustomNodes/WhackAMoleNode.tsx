// Нода «Вдарь Крота» — React-компонент для інтерфейсу ноди
// Відображає налаштування: crop-зона, поріг схожості, інтервал, кнопки завершення
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Hammer, Check, X, Timer, Flag, Crosshair, SlidersHorizontal } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const WhackAMoleNode = memo(({ id, data }: { id: string; data: any }) => {
  // Статус згортання ноди
  const mini = data.miniCollapsed;

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Hammer size={16} />}
      title={data.label || 'Вдарь Крота'}
      bgColor="bg-amber-600"
      type="whackAMoleNode"
      width="w-64"
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

          {/* ── Таймінги ─────────────────────────────────────────── */}
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

          {/* ── Параметри розпізнавання ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">

            {/* Поріг схожості NCC */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <SlidersHorizontal size={11} /> Поріг (0-1)
              </label>
              <input
                type="number"
                value={data.matchThreshold ?? 0.72}
                onChange={(e) => data.onDataChange(id, { matchThreshold: parseFloat(e.target.value) || 0.72 })}
                className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                min={0.3} max={0.99} step={0.01}
              />
            </div>

            {/* Максимальна тривалість */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Timer size={11} /> Макс. (с)
              </label>
              <input
                type="number"
                value={(data.maxDuration ?? 60000) / 1000}
                onChange={(e) => data.onDataChange(id, { maxDuration: (parseInt(e.target.value) || 60) * 1000 })}
                className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                min={5} max={600} step={5}
              />
            </div>
          </div>

          {/* ── Обмеження зони пошуку ─────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-2">
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-bold uppercase">
              <input
                type="checkbox"
                checked={data.useCropZone || false}
                onChange={(e) => data.onDataChange(id, { useCropZone: e.target.checked })}
                className="rounded bg-muted/50 border-border text-amber-500 focus:ring-amber-500 w-3 h-3"
              />
              <Crosshair size={11} />
              <span>Обмежити зону (crop)</span>
            </label>

            {data.useCropZone && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] text-muted-foreground">Початок X</span>
                    <input
                      type="number"
                      value={data.cropX ?? 0}
                      onChange={(e) => data.onDataChange(id, { cropX: parseInt(e.target.value) || 0 })}
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-muted-foreground">Початок Y</span>
                    <input
                      type="number"
                      value={data.cropY ?? 0}
                      onChange={(e) => data.onDataChange(id, { cropY: parseInt(e.target.value) || 0 })}
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                      min={0}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] text-muted-foreground">Ширина (W)</span>
                    <input
                      type="number"
                      value={data.cropW ?? 600}
                      onChange={(e) => data.onDataChange(id, { cropW: parseInt(e.target.value) || 0 })}
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                      min={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-muted-foreground">Висота (H)</span>
                    <input
                      type="number"
                      value={data.cropH ?? 400}
                      onChange={(e) => data.onDataChange(id, { cropH: parseInt(e.target.value) || 0 })}
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-amber-500 outline-none font-mono"
                      min={100}
                    />
                  </div>
                </div>
                <p className="text-[8px] text-muted-foreground italic">
                  Прямокутник на екрані де розташоване ігрове поле 3×3
                </p>
              </div>
            )}
          </div>

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
