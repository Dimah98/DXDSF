// Нода «Гра Послідовність» — React-компонент для інтерфейсу ноди
// Відображає налаштування: 9 предметів, індикатор помилки, індикатор перемоги, пороги та таймінги
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, Check, X, Timer, SlidersHorizontal, LayoutGrid, AlertTriangle, Trophy } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

export interface TargetRegionConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IndicatorConfig extends TargetRegionConfig {
  enabled: boolean;
}

const DEFAULT_9_ITEMS: TargetRegionConfig[] = [
  { x: 100, y: 100, w: 80, h: 80 }, // 1 (0,0)
  { x: 220, y: 100, w: 80, h: 80 }, // 2 (0,1)
  { x: 340, y: 100, w: 80, h: 80 }, // 3 (0,2)
  { x: 100, y: 220, w: 80, h: 80 }, // 4 (1,0)
  { x: 220, y: 220, w: 80, h: 80 }, // 5 (1,1)
  { x: 340, y: 220, w: 80, h: 80 }, // 6 (1,2)
  { x: 100, y: 340, w: 80, h: 80 }, // 7 (2,0)
  { x: 220, y: 340, w: 80, h: 80 }, // 8 (2,1)
  { x: 340, y: 340, w: 80, h: 80 }, // 9 (2,2)
];

const DEFAULT_ERROR_INDICATOR: IndicatorConfig = {
  enabled: true,
  x: 50,
  y: 50,
  w: 40,
  h: 40,
};

const DEFAULT_SUCCESS_INDICATOR: IndicatorConfig = {
  enabled: true,
  x: 420,
  y: 50,
  w: 40,
  h: 40,
};

const SequenceMemoryNode = memo(({ id, data }: { id: string; data: any }) => {
  const mini = data.miniCollapsed;
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [showAllItems, setShowAllItems] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'indicators'>('items');

  // Отримуємо або ініціалізуємо масив 9 предметів
  const getItems = (): TargetRegionConfig[] => {
    if (Array.isArray(data.items) && data.items.length === 9) {
      return data.items;
    }
    return DEFAULT_9_ITEMS;
  };

  const items = getItems();

  const updateItem = (index: number, field: keyof TargetRegionConfig, val: number) => {
    const current = getItems();
    const next = current.map((item, i) => (i === index ? { ...item, [field]: val } : item));
    data.onDataChange(id, { items: next });
  };

  const applySizeToAll = (w: number, h: number) => {
    const current = getItems();
    const next = current.map(item => ({ ...item, w, h }));
    data.onDataChange(id, { items: next });
  };

  const errInd: IndicatorConfig = data.errorIndicator || DEFAULT_ERROR_INDICATOR;
  const updateErrInd = (fields: Partial<IndicatorConfig>) => {
    data.onDataChange(id, { errorIndicator: { ...errInd, ...fields } });
  };

  const succInd: IndicatorConfig = data.successIndicator || DEFAULT_SUCCESS_INDICATOR;
  const updateSuccInd = (fields: Partial<IndicatorConfig>) => {
    data.onDataChange(id, { successIndicator: { ...succInd, ...fields } });
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Sparkles size={16} />}
      title={data.label || 'Гра «Послідовність»'}
      bgColor="bg-indigo-600"
      type="sequenceMemoryNode"
      width="w-72"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#6366f1', '20px', mini)}
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

          {/* ── Параметри та таймінги ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <SlidersHorizontal size={11} /> Поріг (%)
              </label>
              <input
                type="number"
                value={Math.round((data.flashThreshold ?? 0.25) * 100)}
                onChange={(e) => data.onDataChange(id, { flashThreshold: (parseInt(e.target.value) || 25) / 100 })}
                className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                min={5} max={90} step={5}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Timer size={11} /> Пауза (мс)
              </label>
              <input
                type="number"
                value={data.flashSilenceTimeout ?? 1200}
                onChange={(e) => data.onDataChange(id, { flashSilenceTimeout: parseInt(e.target.value) || 1200 })}
                className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                min={500} max={3000} step={100}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Timer size={11} /> Клік (мс)
              </label>
              <input
                type="number"
                value={data.clickDelay ?? 200}
                onChange={(e) => data.onDataChange(id, { clickDelay: parseInt(e.target.value) || 200 })}
                className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                min={50} max={1000} step={50}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Timer size={11} /> Макс. (с)
              </label>
              <input
                type="number"
                value={(data.maxDuration ?? 120000) / 1000}
                onChange={(e) => data.onDataChange(id, { maxDuration: (parseInt(e.target.value) || 120) * 1000 })}
                className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                min={10} max={600} step={10}
              />
            </div>
          </div>

          {/* ── Перемикач вкладок (Предмети / Індикатори) ─────────── */}
          <div className="pt-2 border-t border-border flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'items'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid size={11} /> 9 Предметів
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('indicators')}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'indicators'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trophy size={11} /> Індикатори (2)
            </button>
          </div>

          {/* ── Вкладка: 9 Предметів ─────────────────────────────── */}
          {activeTab === 'items' && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground font-medium">Сітка предметів (3×3)</span>
                <button
                  type="button"
                  onClick={() => setShowAllItems(!showAllItems)}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  {showAllItems ? 'Згорнути' : 'Показати всі 9'}
                </button>
              </div>

              {/* 3×3 Інтерактивний вибір предмета */}
              <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-muted/40 rounded-lg border border-border/50">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                  const isSel = selectedItemIndex === idx;
                  const r = Math.floor(idx / 3);
                  const c = idx % 3;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedItemIndex(idx)}
                      className={`py-1.5 px-2 text-[10px] font-mono font-bold rounded flex flex-col items-center justify-center transition-all ${
                        isSel
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>#{idx + 1}</span>
                      <span className="text-[8px] opacity-75 font-normal">({r},{c})</span>
                    </button>
                  );
                })}
              </div>

              {!showAllItems ? (
                <div className="p-2.5 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-400">
                      Предмет #{selectedItemIndex + 1} ({Math.floor(selectedItemIndex / 3)},{selectedItemIndex % 3})
                    </span>
                    <button
                      type="button"
                      onClick={() => applySizeToAll(items[selectedItemIndex].w, items[selectedItemIndex].h)}
                      className="text-[8px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 transition-colors"
                      title="Застосувати W і H цього предмета до всіх 9"
                    >
                      W/H для всіх 9
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground">Позиція X</span>
                      <input
                        type="number"
                        value={items[selectedItemIndex]?.x ?? 0}
                        onChange={(e) => updateItem(selectedItemIndex, 'x', parseInt(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                        min={0}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground">Позиція Y</span>
                      <input
                        type="number"
                        value={items[selectedItemIndex]?.y ?? 0}
                        onChange={(e) => updateItem(selectedItemIndex, 'y', parseInt(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                        min={0}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground">Ширина (W)</span>
                      <input
                        type="number"
                        value={items[selectedItemIndex]?.w ?? 80}
                        onChange={(e) => updateItem(selectedItemIndex, 'w', parseInt(e.target.value) || 80)}
                        className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                        min={10}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground">Висота (H)</span>
                      <input
                        type="number"
                        value={items[selectedItemIndex]?.h ?? 80}
                        onChange={(e) => updateItem(selectedItemIndex, 'h', parseInt(e.target.value) || 80)}
                        className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-indigo-500 outline-none font-mono"
                        min={10}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-2 bg-muted/40 rounded-lg border border-border/50 space-y-1.5">
                      <div className="text-[9px] font-bold text-indigo-400">
                        Предмет #{idx + 1} ({Math.floor(idx / 3)},{idx % 3})
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <div>
                          <span className="text-[8px] text-muted-foreground">X</span>
                          <input
                            type="number"
                            value={item.x}
                            onChange={(e) => updateItem(idx, 'x', parseInt(e.target.value) || 0)}
                            className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-indigo-500"
                          />
                        </div>
                        <div>
                          <span className="text-[8px] text-muted-foreground">Y</span>
                          <input
                            type="number"
                            value={item.y}
                            onChange={(e) => updateItem(idx, 'y', parseInt(e.target.value) || 0)}
                            className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-indigo-500"
                          />
                        </div>
                        <div>
                          <span className="text-[8px] text-muted-foreground">W</span>
                          <input
                            type="number"
                            value={item.w}
                            onChange={(e) => updateItem(idx, 'w', parseInt(e.target.value) || 80)}
                            className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-indigo-500"
                          />
                        </div>
                        <div>
                          <span className="text-[8px] text-muted-foreground">H</span>
                          <input
                            type="number"
                            value={item.h}
                            onChange={(e) => updateItem(idx, 'h', parseInt(e.target.value) || 80)}
                            className="w-full p-1 text-[10px] bg-background rounded font-mono outline-none focus:ring-1 ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Вкладка: 2 Індикатори ────────────────────────────── */}
          {activeTab === 'indicators' && (
            <div className="space-y-3 animate-in fade-in duration-150">

              {/* 1. Індикатор помилки */}
              <div className="p-2.5 bg-red-500/10 rounded-lg border border-red-500/30 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-red-400">
                    <AlertTriangle size={12} /> Індикатор помилки
                  </div>
                  <input
                    type="checkbox"
                    checked={errInd.enabled}
                    onChange={(e) => updateErrInd({ enabled: e.target.checked })}
                    className="rounded bg-muted border-border text-red-500 focus:ring-red-500 w-3.5 h-3.5"
                  />
                </label>

                {errInd.enabled && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-1">
                      <div>
                        <span className="text-[8px] text-muted-foreground">X</span>
                        <input
                          type="number"
                          value={errInd.x}
                          onChange={(e) => updateErrInd({ x: parseInt(e.target.value) || 0 })}
                          className="w-full p-1 text-[10px] bg-background rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground">Y</span>
                        <input
                          type="number"
                          value={errInd.y}
                          onChange={(e) => updateErrInd({ y: parseInt(e.target.value) || 0 })}
                          className="w-full p-1 text-[10px] bg-background rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground">W</span>
                        <input
                          type="number"
                          value={errInd.w}
                          onChange={(e) => updateErrInd({ w: parseInt(e.target.value) || 40 })}
                          className="w-full p-1 text-[10px] bg-background rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground">H</span>
                        <input
                          type="number"
                          value={errInd.h}
                          onChange={(e) => updateErrInd({ h: parseInt(e.target.value) || 40 })}
                          className="w-full p-1 text-[10px] bg-background rounded font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[8px] text-muted-foreground">При спалаху:</span>
                      <select
                        value={data.onErrorAction || 'reset'}
                        onChange={(e) => data.onDataChange(id, { onErrorAction: e.target.value })}
                        className="text-[9px] bg-background border-none rounded px-1.5 py-0.5 outline-none font-medium text-foreground"
                      >
                        <option value="reset">Скинути раунд</option>
                        <option value="fail">Вийти з помилкою</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Індикатор перемоги */}
              <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400">
                    <Trophy size={12} /> Індикатор перемоги
                  </div>
                  <input
                    type="checkbox"
                    checked={succInd.enabled}
                    onChange={(e) => updateSuccInd({ enabled: e.target.checked })}
                    className="rounded bg-muted border-border text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                </label>

                {succInd.enabled && (
                  <div className="grid grid-cols-4 gap-1">
                    <div>
                      <span className="text-[8px] text-muted-foreground">X</span>
                      <input
                        type="number"
                        value={succInd.x}
                        onChange={(e) => updateSuccInd({ x: parseInt(e.target.value) || 0 })}
                        className="w-full p-1 text-[10px] bg-background rounded font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground">Y</span>
                      <input
                        type="number"
                        value={succInd.y}
                        onChange={(e) => updateSuccInd({ y: parseInt(e.target.value) || 0 })}
                        className="w-full p-1 text-[10px] bg-background rounded font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground">W</span>
                      <input
                        type="number"
                        value={succInd.w}
                        onChange={(e) => updateSuccInd({ w: parseInt(e.target.value) || 40 })}
                        className="w-full p-1 text-[10px] bg-background rounded font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground">H</span>
                      <input
                        type="number"
                        value={succInd.h}
                        onChange={(e) => updateSuccInd({ h: parseInt(e.target.value) || 40 })}
                        className="w-full p-1 text-[10px] bg-background rounded font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Підписи портів ────────────────────────────────────── */}
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase">
              <Check size={10} /> Пройдено
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

export default SequenceMemoryNode;
