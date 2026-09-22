import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Palette, Settings, Timer, Check, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const PRESET_COLORS = [
  { name: 'Синій', value: '#1d4ed8' },
  { name: 'Зелений', value: '#15803d' },
  { name: 'Фіолетовий', value: '#7e22ce' },
  { name: 'Бурштиновий', value: '#b45309' },
  { name: 'Червоний', value: '#b91c1c' },
  { name: 'Бірюзовий', value: '#0f766e' },
  { name: 'Індиго', value: '#4338ca' },
  { name: 'Сланцевий', value: '#334155' },
];

export interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: {
    label?: string;
    color?: string;
    configId?: string | null;
    timeout?: number | string | null;
  };
  nodeData?: {
    label?: string;
    color?: string;
    configId?: string | null;
    timeout?: number | string | null;
  };
  onSave: (newData: {
    label: string;
    color: string;
    configId: string | null;
    timeout: number | null;
  }) => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  data: propData,
  nodeData,
  onSave,
}) => {
  const currentData = propData || nodeData || {};
  const [label, setLabel] = useState(currentData.label || 'Контейнер');
  const [color, setColor] = useState(currentData.color || '#1d4ed8');
  const [configId, setConfigId] = useState<string | null>(currentData.configId || null);
  const [timeoutSec, setTimeoutSec] = useState<string>(
    currentData.timeout !== undefined && currentData.timeout !== null ? String(currentData.timeout) : ''
  );
  const [configs, setConfigs] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeData = propData || nodeData || {};
      setLabel(activeData.label || 'Контейнер');
      setColor(activeData.color || '#1d4ed8');
      setConfigId(activeData.configId || null);
      setTimeoutSec(
        activeData.timeout !== undefined && activeData.timeout !== null ? String(activeData.timeout) : ''
      );

      setIsLoadingConfigs(true);
      fetch(`${API_BASE}/api/configs`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : { configs: [] }))
        .then((d) => setConfigs(d.configs || []))
        .catch(() => setConfigs([]))
        .finally(() => setIsLoadingConfigs(false));
    }
  }, [isOpen, propData, nodeData]);

  if (!isOpen) return null;

  const handleSave = () => {
    const parsedTimeout = timeoutSec.trim() ? parseFloat(timeoutSec.trim()) : null;
    onSave({
      label: label.trim() || 'Контейнер',
      color,
      configId: configId || null,
      timeout: parsedTimeout && !isNaN(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : null,
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-special)] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0f172a] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-full border border-white/20 shadow"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <Settings size={16} className="text-blue-400" />
              Налаштування контейнера
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Тіло форми */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Назва */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Назва контейнера
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Введіть назву..."
            />
          </div>

          {/* Колір контейнера */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Palette size={14} className="text-blue-400" />
                Колір контейнера
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{color}</span>
            </label>
            <div className="flex flex-wrap gap-2 items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
                    color === c.value ? 'border-white scale-110 shadow-md ring-2 ring-blue-400/40' : 'border-black/30'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {color === c.value && <Check size={12} className="text-white drop-shadow" />}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 pl-2 border-l border-slate-700">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 p-0 border-0 rounded cursor-pointer bg-transparent"
                  title="Довільний колір"
                />
              </div>
            </div>
          </div>

          {/* Конфігурація для перевірки */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Settings size={14} className="text-amber-400" />
              Конфігурація перевірки запуску
            </label>
            <select
              value={configId || ''}
              onChange={(e) => setConfigId(e.target.value || null)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
              disabled={isLoadingConfigs}
            >
              <option value="">— Не вибрано (запускати завжди) —</option>
              {configs.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
              {configId ? (
                <span className="text-amber-400/90 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Контейнер запуститься лише якщо конфігурація поверне TRUE
                </span>
              ) : (
                'Контейнер виконується безумовно при надходженні вхідного сигналу'
              )}
            </p>
          </div>

          {/* Обмеження часу роботи (таймаут) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Timer size={14} className="text-emerald-400" />
              Обмеження часу роботи підпрограми (таймаут)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors pr-12"
                placeholder="0 або порожньо = без ліміту"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
                сек
              </span>
            </div>

            {/* Швидкі пресети */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { label: '30с', val: '30' },
                { label: '1 хв', val: '60' },
                { label: '2 хв', val: '120' },
                { label: '5 хв', val: '300' },
                { label: '10 хв', val: '600' },
                { label: 'Без ліміту', val: '' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setTimeoutSec(p.val)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors border ${
                    timeoutSec === p.val
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <p className="mt-1.5 text-[11px] text-slate-400">
              Якщо час виконання підпрограми перевищить ліміт, контейнер буде автоматично зупинено і сигнал продовжить рух далі.
            </p>
          </div>
        </div>

        {/* Футер */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-800 bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Check size={14} />
            Зберегти
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
