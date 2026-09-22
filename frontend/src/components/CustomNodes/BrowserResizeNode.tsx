import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Maximize, ZoomIn, ZoomOut, Monitor, RotateCcw, Check, X, Clock } from 'lucide-react';
import { getDynamicIcon } from '../../utils/dynamicIcon';
import BaseNode, { getHandleStyle } from './BaseNode';

// Пресети розмірів екрана
const SIZE_PRESETS = [
  { label: 'Без змін розміру', value: 'keep', w: 1280, h: 720 },
  { label: '1280 × 720 (HD — Стандарт)', value: '1280x720', w: 1280, h: 720 },
  { label: '1920 × 1080 (Full HD)', value: '1920x1080', w: 1920, h: 1080 },
  { label: '1600 × 900 (HD+)', value: '1600x900', w: 1600, h: 900 },
  { label: '1366 × 768 (Ноутбук)', value: '1366x768', w: 1366, h: 768 },
  { label: '1024 × 768 (4:3)', value: '1024x768', w: 1024, h: 768 },
  { label: '800 × 600 (Компактний)', value: '800x600', w: 800, h: 600 },
  { label: 'Власний розмір...', value: 'custom', w: 1280, h: 720 },
];

// Кроки зуму як у меню Chromium (25%, 33%, 50%, 67%, 75%, 80%, 90%, 100%, 110%, 125%, 150%, 175%, 200%)
const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];

const BrowserResizeNode = memo(({ id, data }: { id: string; data: any }) => {
  const IconComponent = getDynamicIcon(data.customIcon) || Maximize;

  const currentZoom = typeof data.zoomPercent === 'number' ? data.zoomPercent : 100;
  const currentPreset = data.sizePreset || '1280x720';
  const width = data.width ?? 1280;
  const height = data.height ?? 720;
  const windowState = data.windowState || 'normal';
  const waitDelay = data.waitDelay ?? 500;
  const zoomMode = data.zoomMode || 'both';

  // Зменшити масштаб на 1 крок
  const handleZoomOut = () => {
    const smaller = [...ZOOM_STEPS].reverse().find((z) => z < currentZoom);
    const nextZoom = smaller ?? Math.max(25, currentZoom - 10);
    data.onDataChange(id, { zoomPercent: nextZoom });
  };

  // Збільшити масштаб на 1 крок
  const handleZoomIn = () => {
    const bigger = ZOOM_STEPS.find((z) => z > currentZoom);
    const nextZoom = bigger ?? Math.min(300, currentZoom + 10);
    data.onDataChange(id, { zoomPercent: nextZoom });
  };

  // Вибір пресету розміру
  const handlePresetChange = (presetValue: string) => {
    const found = SIZE_PRESETS.find((p) => p.value === presetValue);
    if (found && found.value !== 'custom' && found.value !== 'keep') {
      data.onDataChange(id, {
        sizePreset: presetValue,
        width: found.w,
        height: found.h,
      });
    } else {
      data.onDataChange(id, { sizePreset: presetValue });
    }
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<IconComponent size={16} />}
      title={data.label || 'Розмір та масштаб'}
      bgColor="bg-indigo-600"
      type="browserResizeNode"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#6366f1', '20px', data.miniCollapsed)}
        className="!left-[-6px]"
      />
      {/* Успішний вихід */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={getHandleStyle('#22c55e', '35%', data.miniCollapsed)}
        className="!right-[-6px]"
      />
      {/* Вихід помилки */}
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={getHandleStyle('#ef4444', '65%', data.miniCollapsed)}
        className="!right-[-6px]"
      />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3 w-72">

          {/* ── 1. ЗБІЛЬШЕННЯ БРАУЗЕРА (ЯК У МЕНЮ CHROMIUM) ── */}
          <div className="space-y-1.5 p-2 bg-muted/40 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                <ZoomIn size={12} className="text-indigo-400" /> Збільшити (Зум)
              </label>
              {currentZoom !== 100 && (
                <button
                  type="button"
                  onClick={() => data.onDataChange(id, { zoomPercent: 100 })}
                  className="text-[9px] text-muted-foreground hover:text-indigo-400 flex items-center gap-0.5 transition-colors"
                  title="Скинути до 100%"
                >
                  <RotateCcw size={9} /> 100%
                </button>
              )}
            </div>

            {/* Контролер масштабу: [-] [ 75% ] [+] */}
            <div className="flex items-center gap-1 bg-background/80 p-1 rounded-md border border-border/60">
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-7 h-6 flex items-center justify-center rounded bg-muted hover:bg-muted/80 text-foreground transition-all active:scale-95 text-xs font-bold"
                title="Зменшити масштаб"
              >
                <ZoomOut size={13} />
              </button>

              <div className="flex-1 flex items-center justify-center gap-1">
                <input
                  type="number"
                  value={currentZoom}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 100;
                    data.onDataChange(id, { zoomPercent: Math.max(20, Math.min(300, val)) });
                  }}
                  className="w-12 text-center text-xs font-bold font-mono bg-transparent outline-none text-foreground"
                  min={20}
                  max={300}
                />
                <span className="text-xs font-bold text-muted-foreground select-none">%</span>
              </div>

              <button
                type="button"
                onClick={handleZoomIn}
                className="w-7 h-6 flex items-center justify-center rounded bg-muted hover:bg-muted/80 text-foreground transition-all active:scale-95 text-xs font-bold"
                title="Збільшити масштаб"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Швидкі кнопки найпопулярніших значень зуму */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              {[50, 67, 75, 90, 100, 125].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => data.onDataChange(id, { zoomPercent: z })}
                  className={`flex-1 py-0.5 text-[9px] font-mono font-medium rounded transition-all ${
                    currentZoom === z
                      ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/40'
                      : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {z}%
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. РОЗМІР ВІКНА БРАУЗЕРА ── */}
          <div className="space-y-1.5 p-2 bg-muted/40 rounded-lg border border-border/50">
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
              <Monitor size={12} className="text-indigo-400" /> Розмір вікна
            </label>

            {/* Випадаючий список пресетів */}
            <select
              value={currentPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full h-7 text-xs border rounded bg-background text-foreground border-border px-1.5 outline-none focus:ring-1 ring-indigo-500 font-medium"
            >
              {SIZE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Поля W × H (доступні якщо вибрано пресет або custom) */}
            {currentPreset !== 'keep' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-muted-foreground font-medium">Ширина (W)</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) =>
                      data.onDataChange(id, {
                        width: parseInt(e.target.value) || 0,
                        sizePreset: 'custom',
                      })
                    }
                    className="w-full p-1.5 text-xs bg-background border border-border rounded focus:ring-1 ring-indigo-500 outline-none font-mono"
                    min={400}
                    max={3840}
                  />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-muted-foreground font-medium">Висота (H)</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) =>
                      data.onDataChange(id, {
                        height: parseInt(e.target.value) || 0,
                        sizePreset: 'custom',
                      })
                    }
                    className="w-full p-1.5 text-xs bg-background border border-border rounded focus:ring-1 ring-indigo-500 outline-none font-mono"
                    min={300}
                    max={2160}
                  />
                </div>
              </div>
            )}

            {/* Стан вікна (Normal / Maximized / Fullscreen) */}
            <div className="pt-1">
              <span className="text-[9px] text-muted-foreground font-medium">Стан вікна</span>
              <select
                value={windowState}
                onChange={(e) => data.onDataChange(id, { windowState: e.target.value })}
                className="w-full h-6 text-[10px] border rounded bg-background text-foreground border-border px-1 outline-none focus:ring-1 ring-indigo-500"
              >
                <option value="normal">Звичайний розмір (Normal)</option>
                <option value="maximized">Розгорнути (Maximized)</option>
                <option value="fullscreen">Повноекранний (Fullscreen F11)</option>
                <option value="keep">Не чіпати стан вікна</option>
              </select>
            </div>
          </div>

          {/* ── 3. ДОДАТКОВІ ПАРАМЕТРИ ── */}
          <div className="grid grid-cols-2 gap-2">
            {/* Затримка */}
            <div className="space-y-0.5">
              <label className="text-[9px] text-muted-foreground flex items-center gap-1 font-medium">
                <Clock size={10} /> Затримка (мс)
              </label>
              <input
                type="number"
                value={waitDelay}
                onChange={(e) => data.onDataChange(id, { waitDelay: parseInt(e.target.value) || 0 })}
                className="w-full p-1 text-xs bg-muted border border-border/50 rounded focus:ring-1 ring-indigo-500 outline-none font-mono"
                min={0}
                max={5000}
                step={100}
              />
            </div>

            {/* Режим зуму */}
            <div className="space-y-0.5">
              <label className="text-[9px] text-muted-foreground font-medium">Режим зуму</label>
              <select
                value={zoomMode}
                onChange={(e) => data.onDataChange(id, { zoomMode: e.target.value })}
                className="w-full h-[27px] text-[10px] border rounded bg-muted text-foreground border-border/50 px-1 outline-none focus:ring-1 ring-indigo-500"
              >
                <option value="both">Авто (CDP + CSS)</option>
                <option value="css">Тільки CSS zoom</option>
                <option value="cdp">Тільки CDP Scale</option>
              </select>
            </div>
          </div>

          {/* ── Підписи портів ── */}
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border text-[9px] font-bold uppercase">
            <span className="text-emerald-500 flex items-center gap-1">
              <Check size={10} /> Успішно
            </span>
            <span className="text-red-500 flex items-center gap-1">
              Помилка <X size={10} />
            </span>
          </div>

        </div>
      )}
    </BaseNode>
  );
});

export default BrowserResizeNode;
