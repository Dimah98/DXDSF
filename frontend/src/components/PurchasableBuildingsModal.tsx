import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings, Hammer, Coins, UserCheck, AlertCircle, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ProjectBuildingStatus {
  id: string;
  name: string;
  category: 'BUILDINGS' | 'BLACKSMITH_ITEMS';
  coins: number;
  ingredients: Record<string, number>;
  userIngredients: Record<string, number>;
  requiredLevel: number;
  bumpkinLevel: number;
  userCoins: number;
  isPurchased: boolean;
  canBuild: boolean;
  width: number;
  height: number;
  image: string;
  shopImage?: string;
  categoryImage?: string;
}

interface PurchasableBuildingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onOpenMap: (buildingName?: string) => void;
}

export const PurchasableBuildingsModal: React.FC<PurchasableBuildingsModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onOpenMap,
}) => {
  const [buildings, setBuildings] = useState<ProjectBuildingStatus[]>([]);
  const [bumpkinLevel, setBumpkinLevel] = useState<number>(1);
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings sub-modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editableCatalog, setEditableCatalog] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'BUILDINGS' | 'BLACKSMITH_ITEMS'>('ALL');

  const fetchStatus = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/buildings-status`);
      if (!res.ok) throw new Error(`Помилка ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Не вдалося завантажити статус будівель');

      setBuildings(data.buildings || []);
      setBumpkinLevel(data.bumpkinLevel || 1);
      setCoins(data.coins || 0);
    } catch (err: any) {
      console.error('Failed to fetch buildings status:', err);
      setError(err.message || 'Помилка мережі');
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  const fetchCatalogForSettings = async () => {
    try {
      const res = await fetch('/api/buildings-catalog');
      const data = await res.json();
      if (data.success) {
        setEditableCatalog(data.catalog || []);
        setIsSettingsOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveCatalogSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/buildings-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog: editableCatalog }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSettingsOpen(false);
        fetchStatus();
      } else {
        alert('Помилка збереження: ' + (data.error || 'Невідома'));
      }
    } catch (e: any) {
      alert('Помилка: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  if (!isOpen) return null;

  const filtered = buildings.filter(b => {
    if (filterCategory === 'ALL') return true;
    return b.category === filterCategory;
  });

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0b1329] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-100">
        
        {/* Хедер */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Hammer size={20} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                Будівлі та Предмети для покупки
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30">
                  {projectName}
                </span>
              </h2>
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-0.5">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <UserCheck size={13} /> Рівень: <b>{bumpkinLevel}</b>
                </span>
                <span className="flex items-center gap-1 text-yellow-400 font-medium">
                  <Coins size={13} /> Монети: <b>{coins.toLocaleString()}</b>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              title="Оновити"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={fetchCatalogForSettings}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 transition-colors"
              title="Налаштування розмірів та зображень"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Закрити"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Фільтри категорій */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/40 border-b border-white/5 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${filterCategory === 'ALL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:bg-white/5'}`}
            >
              Всі ({buildings.length})
            </button>
            <button
              onClick={() => setFilterCategory('BUILDINGS')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${filterCategory === 'BUILDINGS' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:bg-white/5'}`}
            >
              Будівлі ({buildings.filter(b => b.category === 'BUILDINGS').length})
            </button>
            <button
              onClick={() => setFilterCategory('BLACKSMITH_ITEMS')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${filterCategory === 'BLACKSMITH_ITEMS' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:bg-white/5'}`}
            >
              Коваль / Предмети ({buildings.filter(b => b.category === 'BLACKSMITH_ITEMS').length})
            </button>
          </div>
        </div>

        {/* Тіло модалки: Список будівель */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {loading && buildings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs">
              <RefreshCw size={24} className="animate-spin mb-2 text-amber-400" />
              Завантаження списку будівель...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-xs">
              Немає доступних будівель для відображення
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((b) => {
                const isLevelOk = bumpkinLevel >= (b.requiredLevel || 1);
                const isCoinsOk = coins >= (b.coins || 0);

                return (
                  <div
                    key={b.id}
                    className={`relative p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                      b.isPurchased
                        ? 'bg-slate-900/30 border-white/5 opacity-50 grayscale'
                        : b.canBuild
                        ? 'bg-slate-900/80 border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-500/70'
                        : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Картинка будівлі */}
                      <div className="relative w-16 h-16 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0">
                        <img
                          src={`/im/${b.image}.png`}
                          alt={b.name}
                          className="max-w-full max-h-full object-contain pixelated"
                          onError={(e) => {
                            // Fallback якщо немає картинки
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-gray-400 bg-black/60 px-1 rounded">
                          {b.width}x{b.height}
                        </span>
                      </div>

                      {/* Інформація про будівлю */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white truncate">{b.name}</h3>
                          {b.isPurchased && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                              <CheckCircle2 size={10} /> Куплено
                            </span>
                          )}
                        </div>

                        {/* Категорія та розмір */}
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>{b.category === 'BUILDINGS' ? 'Будівля' : 'Коваль'}</span>
                          <span>•</span>
                          <span>Розмір: {b.width}x{b.height}</span>
                        </div>

                        {/* Вимоги: Рівень та Монети */}
                        <div className="flex flex-wrap items-center gap-2.5 mt-2 text-[11px]">
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              isLevelOk ? 'text-emerald-400' : 'text-red-400'
                            }`}
                            title={`Потрібен рівень ${b.requiredLevel || 1}, поточний: ${bumpkinLevel}`}
                          >
                            Рівень: <b>{bumpkinLevel} / {b.requiredLevel || 1}</b>
                          </span>

                          {(b.coins || 0) > 0 && (
                            <span
                              className={`flex items-center gap-1 font-medium ${
                                isCoinsOk ? 'text-emerald-400' : 'text-red-400'
                              }`}
                              title={`Потрібно монет: ${b.coins}, є: ${coins}`}
                            >
                              <Coins size={11} />
                              <b>{coins.toLocaleString()} / {(b.coins || 0).toLocaleString()}</b>
                            </span>
                          )}
                        </div>

                        {/* Інгредієнти / Ресурси */}
                        {b.ingredients && Object.keys(b.ingredients).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <div className="text-[10px] font-medium text-gray-400 mb-1">Ресурси:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(b.ingredients).map(([resName, reqQty]) => {
                                const userQty = b.userIngredients?.[resName] ?? 0;
                                const isEnough = userQty >= reqQty;
                                return (
                                  <span
                                    key={resName}
                                    className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                                      isEnough
                                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                                        : 'bg-red-950/40 border-red-500/30 text-red-300'
                                    }`}
                                  >
                                    <span className="font-medium">{resName}:</span>
                                    <b>{userQty} / {reqQty}</b>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Нижня панелька з кнопкою */}
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                      <div className="text-[10px] text-gray-400">
                        {b.isPurchased
                          ? 'Будівля вже є на фермі або в інвентарі'
                          : b.canBuild
                          ? '✅ Достатньо ресурсів для будівництва'
                          : '❌ Не вистачає ресурсів або рівня'}
                      </div>

                      {!b.isPurchased && b.canBuild && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenMap(b.name);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 flex items-center gap-1.5"
                        >
                          <Hammer size={12} />
                          Построїти
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Модалка налаштувань каталогу (⚙️) */}
        {isSettingsOpen && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 md:p-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-amber-400" />
                <h3 className="text-sm md:text-base font-bold text-white">
                  Налаштування зображень будівель
                </h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 custom-scrollbar text-xs">
              <div className="text-[11px] text-gray-400 mb-2">
                Тут ви можете налаштувати назву файлу зображення будівлі, а також картинку магазину та категорії для автоматичної ноди.
              </div>

              {editableCatalog.map((item, idx) => (
                <div key={item.id || idx} className="p-2.5 bg-slate-900/70 border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{item.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{item.id} ({item.category})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-[9px] text-gray-400 block">Зображення:</span>
                      <input
                        type="text"
                        value={item.image || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableCatalog(prev => prev.map((x, i) => i === idx ? { ...x, image: val } : x));
                        }}
                        placeholder="file_name"
                        className="w-full bg-[#1e293b] text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block">Категорія (img):</span>
                      <input
                        type="text"
                        value={item.categoryImage || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableCatalog(prev => prev.map((x, i) => i === idx ? { ...x, categoryImage: val } : x));
                        }}
                        placeholder="cat_img"
                        className="w-full bg-[#1e293b] text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block">Магазин (img):</span>
                      <input
                        type="text"
                        value={item.shopImage || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableCatalog(prev => prev.map((x, i) => i === idx ? { ...x, shopImage: val } : x));
                        }}
                        placeholder="shop_img"
                        className="w-full bg-[#1e293b] text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium"
              >
                Скасувати
              </button>
              <button
                onClick={saveCatalogSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {savingSettings ? 'Збереження...' : 'Зберегти налаштування'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
