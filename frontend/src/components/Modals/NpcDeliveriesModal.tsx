import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  RefreshCw,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  Settings2,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Sliders,
  CopyCheck,
  Check,
  Ban,
  Cog,
  Play,
  Package
} from 'lucide-react';
import staticNpcDeliveries from '../../data/npcDeliveries.json';
import { getCleanImageUrl } from '../../utils/imageUtils';

export type DeliveryStatus = 'skip' | 'deliver' | 'config';

export interface DeliverySetting {
  status: DeliveryStatus;
  configId?: string;
}

export interface DeliveryItem {
  name: string;
  amount: number;
  image: string;
}

export interface DeliveryOption {
  id: string;
  signature: string;
  items: DeliveryItem[];
  reward: string;
  rewardType: 'coins' | 'flower' | 'tickets';
  rewardIcon: string;
  cost: string;
}

export interface NpcData {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  category: 'FLOWER' | 'COINS' | 'TICKETS' | string;
  avgReward: string;
  avgCost: string;
  deliveriesCount: number;
  deliveries: DeliveryOption[];
}

export interface ConfigLite {
  id: string;
  name: string;
  description?: string;
  rulesCount?: number;
}

const ItemImage: React.FC<{ name: string; image: string }> = React.memo(({ name, image }) => {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const getInitialSrc = (img: string, nm: string) => {
    const target = img || `${nm}.png`;
    return getCleanImageUrl(target);
  };

  const [currentSrc, setCurrentSrc] = useState<string>(() => getInitialSrc(image, name));

  useEffect(() => {
    setFailed(false);
    setAttempt(0);
    setCurrentSrc(getInitialSrc(image, name));
  }, [name, image]);

  const handleError = () => {
    if (attempt === 0) {
      setAttempt(1);
      const clean = getCleanImageUrl(image || `${name}.png`);
      const sep = clean.includes('?') ? '&' : '?';
      setCurrentSrc(`${clean}${sep}t=${Date.now()}`);
    } else if (attempt === 1) {
      setAttempt(2);
      setCurrentSrc(`/api/im/${encodeURIComponent(name.toLowerCase())}.png?t=${Date.now()}`);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div
        className="w-10 h-10 flex flex-col items-center justify-center bg-white/5 rounded-lg border border-white/10 text-white/40"
        title={name}
      >
        <Package size={16} />
        <span className="text-[8px] font-mono leading-none mt-0.5 max-w-[34px] truncate">{name.slice(0, 4)}</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={handleError}
      className="w-10 h-10 object-contain transition-transform group-hover:scale-110 select-none pointer-events-none"
    />
  );
});

interface NpcDeliveriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectName?: string;
}

export const NpcDeliveriesModal: React.FC<NpcDeliveriesModalProps> = ({
  isOpen,
  onClose,
  defaultProjectName
}) => {
  // Дані NPC та доставок
  const [npcDataMap, setNpcDataMap] = useState<Record<string, NpcData>>(
    staticNpcDeliveries as unknown as Record<string, NpcData>
  );

  // Список проектів
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    defaultProjectName || 'global'
  );

  // Конфігурації з ConfigStore
  const [configs, setConfigs] = useState<ConfigLite[]>([]);

  // Налаштування: { [deliveryId]: { status, configId } }
  const [settings, setSettings] = useState<Record<string, DeliverySetting>>({});
  const [initialSettings, setInitialSettings] = useState<Record<string, DeliverySetting>>({});

  // UI стан
  const [selectedNpcKey, setSelectedNpcKey] = useState<string>('BETTY');
  const [npcCategoryFilter, setNpcCategoryFilter] = useState<'ALL' | 'FLOWER' | 'COINS' | 'TICKETS'>('ALL');
  const [npcSearch, setNpcSearch] = useState('');
  const [variantStatusFilter, setVariantStatusFilter] = useState<'ALL' | 'deliver' | 'config' | 'skip'>('ALL');
  const [variantSearch, setVariantSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; passed: boolean } | null>(null);

  // Відображення toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Завантаження проектів та конфігурацій
  useEffect(() => {
    if (!isOpen) return;

    const loadPrerequisites = async () => {
      try {
        // Проекти
        const projRes = await fetch('/api/projects');
        if (projRes.ok) {
          const projs = await projRes.json();
          if (Array.isArray(projs)) setProjects(projs);
        }

        // Конфігурації
        const cfgRes = await fetch('/api/configs');
        if (cfgRes.ok) {
          const cfgJson = await cfgRes.json();
          if (cfgJson.success && Array.isArray(cfgJson.configs)) {
            setConfigs(
              cfgJson.configs.map((c: any) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                rulesCount: c.rules?.length || 0,
              }))
            );
          }
        }

        // Каталог доставок NPC (якщо оновлений на бекенді)
        const delivRes = await fetch('/api/npc-deliveries');
        if (delivRes.ok) {
          const delivJson = await delivRes.json();
          if (delivJson.success && delivJson.data) {
            setNpcDataMap(delivJson.data);
          }
        }
      } catch (e) {
        console.error('Failed to load prerequisites for NPC Deliveries:', e);
      }
    };

    loadPrerequisites();
  }, [isOpen]);

  // Завантаження налаштувань для обраного проекту
  const fetchSettings = async (projName: string) => {
    setLoading(true);
    try {
      const url = projName && projName !== 'global'
        ? `/api/npc-deliveries/settings?projectName=${encodeURIComponent(projName)}`
        : `/api/npc-deliveries/settings`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const loaded = data.settings || {};
        setSettings(loaded);
        setInitialSettings(JSON.parse(JSON.stringify(loaded)));
      }
    } catch (e) {
      console.error('Failed to fetch NPC delivery settings:', e);
      showToast('Не вдалося завантажити налаштування', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings(selectedProject);
    }
  }, [isOpen, selectedProject]);

  // Список всіх NPC
  const npcList = useMemo(() => {
    return Object.values(npcDataMap);
  }, [npcDataMap]);

  // Фільтрація NPC
  const filteredNpcList = useMemo(() => {
    return npcList.filter((npc) => {
      if (npcCategoryFilter !== 'ALL' && npc.category !== npcCategoryFilter) {
        return false;
      }
      if (npcSearch.trim()) {
        const query = npcSearch.toLowerCase();
        return (
          npc.name.toLowerCase().includes(query) ||
          npc.displayName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [npcList, npcCategoryFilter, npcSearch]);

  // Активний обраний NPC
  const currentNpc = useMemo(() => {
    return (
      npcDataMap[selectedNpcKey] ||
      filteredNpcList[0] ||
      npcList[0] ||
      null
    );
  }, [npcDataMap, selectedNpcKey, filteredNpcList, npcList]);

  // Підрахунок статусів для конкретного NPC
  const getNpcStats = (npc: NpcData) => {
    let deliver = 0;
    let config = 0;
    let skip = 0;
    let notSet = 0;

    for (const del of npc.deliveries) {
      const st = settings[del.id]?.status;
      if (st === 'deliver') deliver++;
      else if (st === 'config') config++;
      else if (st === 'skip') skip++;
      else notSet++;
    }

    return { deliver, config, skip, notSet, total: npc.deliveries.length };
  };

  // Варіанти доставок поточного NPC з фільтрацією
  const filteredDeliveries = useMemo(() => {
    if (!currentNpc) return [];
    return currentNpc.deliveries.filter((del) => {
      const st = settings[del.id]?.status || 'none';
      if (variantStatusFilter !== 'ALL') {
        if (variantStatusFilter === 'skip') {
          if (st !== 'skip') return false;
        } else if (variantStatusFilter === 'deliver') {
          if (st !== 'deliver') return false;
        } else if (variantStatusFilter === 'config') {
          if (st !== 'config') return false;
        }
      }
      if (variantSearch.trim()) {
        const q = variantSearch.toLowerCase();
        const hasItem = del.items.some((it) => it.name.toLowerCase().includes(q));
        return hasItem;
      }
      return true;
    });
  }, [currentNpc, settings, variantStatusFilter, variantSearch]);

  // Перевірка наявності незбережених змін
  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  // Зміна статусу доставки
  const handleSetStatus = (deliveryId: string, status: DeliveryStatus, configId?: string) => {
    setSettings((prev) => {
      const existing = prev[deliveryId] || { status: 'skip' };
      const updatedConfigId = configId !== undefined ? configId : (existing.configId || (configs[0]?.id || ''));
      return {
        ...prev,
        [deliveryId]: {
          status,
          configId: status === 'config' ? updatedConfigId : undefined,
        },
      };
    });
  };

  // Зміна конфігурації для доставки
  const handleSetConfigId = (deliveryId: string, configId: string) => {
    setSettings((prev) => ({
      ...prev,
      [deliveryId]: {
        status: 'config',
        configId,
      },
    }));
  };

  // Масові дії для поточного NPC
  const handleMassAction = (status: DeliveryStatus, configId?: string) => {
    if (!currentNpc) return;
    setSettings((prev) => {
      const next = { ...prev };
      const defaultCfg = configId || configs[0]?.id || '';
      for (const del of currentNpc.deliveries) {
        next[del.id] = {
          status,
          configId: status === 'config' ? defaultCfg : undefined,
        };
      }
      return next;
    });
    showToast(`Всі доставки ${currentNpc.displayName} встановлено: ${status === 'deliver' ? 'Доставляти' : status === 'config' ? 'Конфігурація' : 'Пропускати'}`, 'info');
  };

  // Збереження налаштувань
  const handleSave = async (applyToAll: boolean = false) => {
    setSaving(true);
    try {
      const res = await fetch('/api/npc-deliveries/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: selectedProject === 'global' ? undefined : selectedProject,
          settings,
          applyToAll,
        }),
      });

      if (res.ok) {
        setInitialSettings(JSON.parse(JSON.stringify(settings)));
        showToast(
          applyToAll
            ? '✅ Налаштування збережено та застосовано до всіх проектів!'
            : '✅ Налаштування успішно збережено!',
          'success'
        );
      } else {
        showToast('❌ Помилка збереження налаштувань', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ Помилка з\'єднання з сервером', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Тестування конфігурації
  const handleTestConfig = async (deliveryId: string, configId?: string) => {
    if (!configId) {
      showToast('Оберіть конфігурацію для тестування', 'error');
      return;
    }
    const proj = selectedProject === 'global' ? (projects[0] || 'SF1') : selectedProject;
    setTestingConfigId(deliveryId);
    try {
      const res = await fetch('/api/npc-deliveries/test-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: proj,
          configId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ id: deliveryId, passed: data.passed });
        showToast(
          data.passed
            ? `✅ Конфіг ${configId}: TRUE (Буде доставлено для ${proj})`
            : `❌ Конфіг ${configId}: FALSE (Буде пропущено для ${proj})`,
          data.passed ? 'success' : 'error'
        );
      }
    } catch (e) {
      showToast('Помилка перевірки конфігурації', 'error');
    } finally {
      setTestingConfigId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl w-full max-w-[1400px] h-[92vh] flex flex-col relative overflow-hidden text-slate-200">
        
        {/* Toast сповіщення */}
        {toast && (
          <div
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border backdrop-blur-md transition-all flex items-center gap-2 animate-in slide-in-from-top-4 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-300'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={16} />}
            {toast.type === 'error' && <XCircle size={16} />}
            {toast.type === 'info' && <Sparkles size={16} />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* ШАПКА ВІКНА */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/5 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Settings2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Налаштування доставок NPC
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  sfl.world v2.3
                </span>
              </div>
              <p className="text-xs text-white/50">
                Керування статусами виконання доставок (Пропускати / Доставляти / За конфігурацією)
              </p>
            </div>
          </div>

          {/* Селектор проекту та збереження */}
          <div className="flex items-center gap-2.5">
            {/* Вибір проекту */}
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5">
              <span className="text-xs font-semibold text-white/60">Проект:</span>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-transparent text-xs font-bold text-amber-400 outline-none cursor-pointer pr-1"
              >
                <option value="global" className="bg-slate-900 text-white">
                  🌐 Глобальні (всі проекти)
                </option>
                {projects.map((proj) => (
                  <option key={proj} value={proj} className="bg-slate-900 text-white">
                    📍 {proj}
                  </option>
                ))}
              </select>
            </div>

            {/* Кнопка "Застосувати до всіх" */}
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 active:scale-95 shadow-lg disabled:opacity-50"
              title="Застосувати поточні налаштування як глобальні для всіх проектів"
            >
              <CopyCheck size={14} />
              <span className="hidden sm:inline">Для всіх проектів</span>
            </button>

            {/* Кнопка "Зберегти" */}
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all shadow-lg active:scale-95 ${
                hasChanges
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              } disabled:opacity-50`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{hasChanges ? 'Зберегти зміни' : 'Збережено'}</span>
            </button>

            {/* Оновити */}
            <button
              onClick={() => fetchSettings(selectedProject)}
              disabled={loading}
              className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
              title="Перезавантажити"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Закрити */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
              title="Закрити"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ГОЛОВНИЙ ВМІСТ: ДВОКОЛОНКОВИЙ ЛЕЙАУТ */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ЛІВА ПАНЕЛЬ: СПИСОК ВСІХ 24 NPC */}
          <div className="w-80 md:w-88 border-r border-white/10 flex flex-col bg-slate-950/40 shrink-0">
            {/* Пошук NPC */}
            <div className="p-3 border-b border-white/5 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Пошук NPC..."
                  value={npcSearch}
                  onChange={(e) => setNpcSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Категорії NPC */}
              <div className="grid grid-cols-4 gap-1">
                {(['ALL', 'FLOWER', 'COINS', 'TICKETS'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNpcCategoryFilter(cat)}
                    className={`py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all text-center ${
                      npcCategoryFilter === cat
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'Всі (24)' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Список NPC карток */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {filteredNpcList.map((npc) => {
                const isSelected = selectedNpcKey === npc.name;
                const stats = getNpcStats(npc);

                return (
                  <button
                    key={npc.name}
                    onClick={() => setSelectedNpcKey(npc.name)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    {/* Аватар NPC */}
                    <div className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-inner relative">
                      <img
                        src={`/api/im/${npc.icon}`}
                        alt={npc.name}
                        className="w-9 h-9 object-contain"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/api/im/betty.png';
                        }}
                      />
                      {/* Категорійний бейдж */}
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black ${
                          npc.category === 'FLOWER'
                            ? 'bg-pink-500'
                            : npc.category === 'COINS'
                            ? 'bg-amber-400'
                            : 'bg-sky-400'
                        }`}
                        title={npc.category}
                      />
                    </div>

                    {/* Інформація про NPC */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold truncate uppercase ${
                            isSelected ? 'text-amber-400' : 'text-white'
                          }`}
                        >
                          {npc.displayName}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          {npc.deliveriesCount}
                        </span>
                      </div>

                      {/* Міні індикатори налаштувань */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-[10px]">
                          {stats.deliver > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[9px]">
                              {stats.deliver}✓
                            </span>
                          )}
                          {stats.config > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold text-[9px]">
                              {stats.config}⚙
                            </span>
                          )}
                          {stats.skip > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-mono font-bold text-[9px]">
                              {stats.skip}✕
                            </span>
                          )}
                        </div>

                        {npc.avgReward && (
                          <span className="text-[9px] text-white/40 truncate ml-auto font-mono">
                            ~{npc.avgReward} {npc.category === 'COINS' ? '🪙' : npc.category === 'FLOWER' ? '🌸' : '🎟️'}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      size={14}
                      className={`text-white/30 transition-transform ${
                        isSelected ? 'text-amber-400 translate-x-0.5' : ''
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ПРАВА ОБЛАСТЬ: ВАРІАНТИ ДОСТАВОК ОБРАНОГО NPC */}
          <div className="flex-1 flex flex-col bg-slate-900/30 overflow-hidden">
            {currentNpc ? (
              <>
                {/* ШАПКА ОБРАНОГО NPC ТА МАСОВІ ДІЇ */}
                <div className="p-4 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shadow-inner">
                      <img
                        src={`/api/im/${currentNpc.icon}`}
                        alt={currentNpc.name}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/api/im/betty.png';
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white uppercase tracking-wide">
                          {currentNpc.displayName}
                        </h3>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            currentNpc.category === 'FLOWER'
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                              : currentNpc.category === 'COINS'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {currentNpc.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/50 mt-0.5">
                        <span>Всього варіантів: <strong className="text-white">{currentNpc.deliveriesCount}</strong></span>
                        {currentNpc.avgReward && (
                          <span>Сер. нагорода: <strong className="text-amber-400">{currentNpc.avgReward}</strong></span>
                        )}
                        {currentNpc.avgCost && (
                          <span>Сер. собівартість: <strong className="text-white/80">{currentNpc.avgCost}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Масові кнопки для поточного NPC */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-white/40 mr-1 hidden sm:inline">Для всіх {currentNpc.displayName}:</span>

                    {/* Всі Доставляти */}
                    <button
                      onClick={() => handleMassAction('deliver')}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 active:scale-95 transition-all flex items-center gap-1.5"
                      title="Встановити 'Доставляти' для всіх доставок цього NPC"
                    >
                      <Check size={13} />
                      <span>Всі: Доставляти</span>
                    </button>

                    {/* Всі Пропускати */}
                    <button
                      onClick={() => handleMassAction('skip')}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 active:scale-95 transition-all flex items-center gap-1.5"
                      title="Встановити 'Пропускати' для всіх доставок цього NPC"
                    >
                      <Ban size={13} />
                      <span>Всі: Пропускати</span>
                    </button>

                    {/* Всі Конфігурація */}
                    {configs.length > 0 && (
                      <button
                        onClick={() => handleMassAction('config')}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 active:scale-95 transition-all flex items-center gap-1.5"
                        title="Встановити 'Конфігурація' для всіх доставок цього NPC"
                      >
                        <Cog size={13} />
                        <span>Всі: Конфіг</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ПАНЕЛЬ ФІЛЬТРІВ ПО ВАРІАНТАХ */}
                <div className="px-4 py-2.5 border-b border-white/5 bg-black/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Filter size={12} /> Фільтр:
                    </span>
                    {(['ALL', 'deliver', 'config', 'skip'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setVariantStatusFilter(filter)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          variantStatusFilter === filter
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {filter === 'ALL'
                          ? `Всі (${currentNpc.deliveries.length})`
                          : filter === 'deliver'
                          ? 'Доставляти'
                          : filter === 'config'
                          ? 'Конфігурація'
                          : 'Пропускати'}
                      </button>
                    ))}
                  </div>

                  {/* Пошук по предметах у варіантах */}
                  <div className="relative w-48 sm:w-64">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Пошук за предметом..."
                      value={variantSearch}
                      onChange={(e) => setVariantSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                {/* СПИСОК ВАРІАНТІВ ДОСТАВОК */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {filteredDeliveries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-white/40">
                      <Layers size={32} className="mb-2 opacity-50" />
                      <span className="text-xs">Немає доставок за обраними фільтрами</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {filteredDeliveries.map((delivery) => {
                        const currentSetting = settings[delivery.id] || { status: 'skip' };
                        const status = currentSetting.status;
                        const isTesting = testingConfigId === delivery.id;

                        // Кольори картки відповідно до статусу
                        let cardBorder = 'border-white/10';
                        let cardBg = 'bg-slate-950/40';

                        if (status === 'deliver') {
                          cardBorder = 'border-emerald-500/40 shadow-emerald-500/5';
                          cardBg = 'bg-emerald-950/20';
                        } else if (status === 'config') {
                          cardBorder = 'border-cyan-500/40 shadow-cyan-500/5';
                          cardBg = 'bg-cyan-950/20';
                        } else if (status === 'skip') {
                          cardBorder = 'border-rose-500/30';
                          cardBg = 'bg-rose-950/10';
                        }

                        return (
                          <div
                            key={delivery.id}
                            className={`p-3.5 rounded-2xl border ${cardBorder} ${cardBg} shadow-lg flex flex-col justify-between gap-3 transition-all hover:border-white/30`}
                          >
                            {/* ВЕРХНЯ ЧАСТИНА: ПРЕДМЕТИ (ЗОБРАЖЕННЯ) ТА НАГОРОДА */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono text-white/40 uppercase">
                                  #{delivery.id}
                                </span>

                                {/* Нагорода */}
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">
                                  <img
                                    src={`/api/im/${delivery.rewardIcon}`}
                                    alt="Reward"
                                    className="w-4 h-4 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = '/api/im/coins.png';
                                    }}
                                  />
                                  <span className="text-xs font-black text-amber-300 font-mono">
                                    {delivery.reward}
                                  </span>
                                  {delivery.cost && (
                                    <span className="text-[10px] text-white/40 ml-1 truncate" title={`Собівартість: ${delivery.cost}`}>
                                      ({delivery.cost})
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* ВАРІАНТ: ПРЕДМЕТИ У ВИГЛЯДІ ЗОБРАЖЕНЬ (як просив користувач) */}
                              <div className="flex flex-wrap items-center gap-2 py-1">
                                {delivery.items.map((item, itIdx) => (
                                  <div
                                    key={itIdx}
                                    className="group relative flex items-center justify-center w-12 h-12 rounded-xl bg-black/50 border border-white/10 hover:border-amber-500/50 transition-all p-1 shadow-inner shrink-0"
                                  >
                                    <ItemImage name={item.name} image={item.image} />
                                    {/* Бейдж кількості */}
                                    <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.2 rounded-md shadow-md border border-black/40 font-mono select-none">
                                      x{item.amount}
                                    </span>

                                    {/* Спливаюча підказка з назвою при наведенні */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-black/90 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10 z-20">
                                      {item.name}: {item.amount}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* НИЖНЯ ЧАСТИНА: СЕЛЕКТОР СТАТУСУ */}
                            <div className="space-y-2 border-t border-white/5 pt-2.5">
                              {/* 3-позиційний перемикач */}
                              <div className="grid grid-cols-3 gap-1 p-1 bg-black/50 rounded-xl border border-white/10">
                                {/* Пропускати */}
                                <button
                                  type="button"
                                  onClick={() => handleSetStatus(delivery.id, 'skip')}
                                  className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                    status === 'skip'
                                      ? 'bg-rose-500 text-white shadow-md'
                                      : 'text-white/50 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <Ban size={12} />
                                  <span>Пропуск</span>
                                </button>

                                {/* Доставляти */}
                                <button
                                  type="button"
                                  onClick={() => handleSetStatus(delivery.id, 'deliver')}
                                  className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                    status === 'deliver'
                                      ? 'bg-emerald-500 text-black font-black shadow-md'
                                      : 'text-white/50 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <Check size={12} />
                                  <span>Доставляти</span>
                                </button>

                                {/* Конфігурація */}
                                <button
                                  type="button"
                                  onClick={() => handleSetStatus(delivery.id, 'config')}
                                  className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                    status === 'config'
                                      ? 'bg-cyan-500 text-black font-black shadow-md'
                                      : 'text-white/50 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <Cog size={12} />
                                  <span>Конфіг</span>
                                </button>
                              </div>

                              {/* СЕЛЕКТОР КОНФІГУРАЦІЇ (якщо обрано статус "config") */}
                              {status === 'config' && (
                                <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-1.5 animate-in fade-in">
                                  <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold">
                                    <span>Конфігурація (Config Manager):</span>
                                    <span className="text-white/40">True → Дост. / False → Проп.</span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={currentSetting.configId || ''}
                                      onChange={(e) => handleSetConfigId(delivery.id, e.target.value)}
                                      className="flex-1 bg-black/60 border border-cyan-500/40 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                                    >
                                      {configs.length === 0 ? (
                                        <option value="">Немає конфігурацій</option>
                                      ) : (
                                        configs.map((c) => (
                                          <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                                            {c.name} ({c.rulesCount || 0} правил)
                                          </option>
                                        ))
                                      )}
                                    </select>

                                    {/* Кнопка тесту конфігурації */}
                                    <button
                                      type="button"
                                      onClick={() => handleTestConfig(delivery.id, currentSetting.configId)}
                                      disabled={isTesting || !currentSetting.configId}
                                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 disabled:opacity-50"
                                      title="Перевірити конфігурацію для обраного проекту зараз"
                                    >
                                      {isTesting ? (
                                        <Loader2 size={11} className="animate-spin" />
                                      ) : (
                                        <Play size={11} />
                                      )}
                                      <span>Тест</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <Sliders size={40} className="mb-2 opacity-40" />
                <span>Оберіть NPC зі списку ліворуч</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpcDeliveriesModal;
