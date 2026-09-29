import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './FarmCardsOverview.css';
import {
  ArrowLeft,
  Settings,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  Clock,
  Sparkles,
  Box,
  LayoutGrid
} from 'lucide-react';
import { getCleanImageUrl, handleImageErrorWithCacheBust } from '../utils/imageUtils';

// Інтерфейс для кожної картки проекту
export interface FarmCardData {
  projectName: string;
  level: number;
  experience: number;
  islandType: string;
  islandExpansions: number;
  season?: string;
  deliveries: {
    coins: number;
    flower: number;
    ticket: number;
  };
  helpedPlayers: {
    current: number;
    max: number;
  };
  minigames: {
    completed: number;
    total: number;
  };
  crops: {
    name: string;
    totalAmount: number;
    remainingMs: number;
    isReady: boolean;
    count: number;
  }[];
  seasonalCropSeeds: {
    name: string;
    count: number;
  }[];
  fruitTrees: {
    id: string;
    name: string;
    harvestsLeft: number;
    amount: number;
    isReady: boolean;
    isDead?: boolean;
    readyAt: number;
    remainingMs: number;
  }[];
  seasonalFruitSeeds?: {
    name: string;
    count: number;
  }[];
  chickens?: {
    id: string;
    level: number;
    experience: number;
    sleepRemainingMs: number;
    isSleeping: boolean;
    careRemainingMs: number;
    canCare: boolean;
    state: 'sleeping' | 'hungry' | 'sick';
    desiredItem: string;
    isSick: boolean;
  }[];
  resources: {
    name: string;
    readyCount: number;
    totalCount: number;
    remainingMs: number;
  }[];
  tools: {
    name: string;
    inventoryCount: number;
    stockCount: number;
  }[];
  growingFlowers: {
    name: string;
    readyAt: number;
    remainingMs: number;
    isReady: boolean;
  }[];
  seasonalFlowerSeeds: {
    name: string;
    count: number;
  }[];
  cookingDishes: {
    name: string;
    buildingName: string;
    readyAt: number;
    remainingMs: number;
    isReady: boolean;
  }[];
  composters: {
    name: 'Compost Bin' | 'Turbo Composter' | 'Premium Composter';
    status: 'idle_ready' | 'idle_missing_resources' | 'producing' | 'ready';
    producingItem?: string;
    readyAt?: number;
    remainingMs?: number;
  }[];
  bigFruitProjects: {
    name: string;
    cheers: number;
    goal: number;
    isCompleted: boolean;
  }[];
  fishing: {
    dailyAttempts: number;
    dailyLimit: number;
    rodsCount: number;
    baits: {
      name: string;
      count: number;
    }[];
  };
  islandUpgrade: {
    currentLevel: number;
    requiredLevel: number;
    resourceName: string;
    currentResource: number;
    requiredResource: number;
    resources?: Array<{
      name: string;
      current: number;
      required: number;
      isReady: boolean;
    }>;
    coinsRequired?: number;
    coinsCurrent?: number;
    nextIslandType: string;
    targetLabel?: string;
    tooltip?: string;
    isMaxLevel?: boolean;
    isLastUpgrade?: boolean;
    canUpgrade: boolean;
  } | null;
}

// Налаштування видимості блоків
export interface CardSettings {
  showTitleHeader: boolean;          // 1. Назва проекту, Lvl, тип острова
  showDeliveriesActivity: boolean;   // 2. Доставки, допомога, міні-ігри
  showCrops: boolean;                // 3. Грядки (що росте і врожай)
  showSeasonalCropSeeds: boolean;    // 4. Насіння рослин поточного сезону
  showFruitTrees: boolean;           // 5. Фруктові дерева
  showSeasonalFruitSeeds: boolean;   // 6. Насіння фруктових дерев поточного сезону в інвентарі
  showChickens: boolean;             // 7. Кури в курятнику
  showResources: boolean;            // 8. Ресурси для збору (дерево, камінь тощо)
  showTools: boolean;                // 9. Інструменти (інвентар і склад)
  showFlowers: boolean;              // 10. Квітки що ростуть
  showSeasonalFlowerSeeds: boolean;  // 11. Насіння квітів поточного сезону
  showCooking: boolean;              // 12. Страви що готуються
  showComposters: boolean;           // 13. 3 компостери
  showBigFruits: boolean;            // 14. Великі фрукти Project
  showFishing: boolean;              // 15. Риболовля
  showIslandUpgrade: boolean;        // 16. Ресурси для покращення острова
  columnsCount: number;              // Кількість колонок (за замовчуванням 5)
}

const DEFAULT_SETTINGS: CardSettings = {
  showTitleHeader: true,
  showDeliveriesActivity: true,
  showCrops: true,
  showSeasonalCropSeeds: true,
  showFruitTrees: true,
  showSeasonalFruitSeeds: true,
  showChickens: true,
  showResources: true,
  showTools: true,
  showFlowers: true,
  showSeasonalFlowerSeeds: true,
  showCooking: true,
  showComposters: true,
  showBigFruits: true,
  showFishing: true,
  showIslandUpgrade: true,
  columnsCount: 5,
};

const SETTINGS_STORAGE_KEY = 'sf_farm_cards_settings';

const SEASON_UKRAINIAN: Record<string, string> = {
  spring: 'Весна',
  summer: 'Літо',
  autumn: 'Осінь',
  winter: 'Зима'
};

// Допоміжні функції форматування часу
function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Готово';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}г ${minutes}хв`;
  }
  if (minutes > 0) {
    return `${minutes}хв ${seconds}с`;
  }
  return `${seconds}с`;
}

interface FarmCardsOverviewProps {
  currentView: string;
  setCurrentView: (view: any) => void;
}

export const FarmCardsOverview: React.FC<FarmCardsOverviewProps> = ({ setCurrentView }) => {
  const [cards, setCards] = useState<FarmCardData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTimestamp, setServerTimestamp] = useState<number>(Date.now());
  const [clientFetchTime, setClientFetchTime] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Зчитування налаштувань з localStorage
  const [settings, setSettings] = useState<CardSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_SETTINGS;
  });

  const saveSettings = (newSettings: CardSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (_) {}
  };

  // Отримання даних з бекенду
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/all-farm-cards');
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.cards)) {
        setCards(data.cards);
        setServerTimestamp(data.timestamp || Date.now());
        setClientFetchTime(Date.now());
      } else {
        throw new Error(data.error || 'Помилка завантаження карток');
      }
    } catch (err: any) {
      console.error('Failed to fetch farm cards:', err);
      setError(err.message || 'Не вдалося завантажити картки проектів');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Автооновлення кожні 45 секунд
  useEffect(() => {
    const autoRefresh = setInterval(() => {
      fetchData();
    }, 45000);
    return () => clearInterval(autoRefresh);
  }, [fetchData]);

  // Плавний секундний таймер для зворотного відліку
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Розрахунок різниці в часі з сервером
  const elapsedSinceFetch = now - clientFetchTime;

  // Фільтрація карток за пошуком
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const query = searchQuery.toLowerCase().trim();
    return cards.filter(c =>
      c.projectName.toLowerCase().includes(query) ||
      c.islandType.toLowerCase().includes(query)
    );
  }, [cards, searchQuery]);

  return (
    <div className="farm-cards-container">
      {/* Верхній тулбар */}
      <header className="farm-cards-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('editor')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow border border-slate-700 text-xs font-semibold"
            title="Назад до редактора"
          >
            <ArrowLeft size={14} />
            <span>Редактор</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-700 hidden sm:block" />

          <button
            onClick={() => setCurrentView('inventory')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 text-xs font-medium"
          >
            <Box size={14} />
            <span>Зведений інвентар</span>
          </button>

          <button
            onClick={() => setCurrentView('scheduler')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 text-xs font-medium"
          >
            <Clock size={14} />
            <span>Розклад запусків</span>
          </button>

          <div className="flex items-center gap-1.5 ml-2 text-sm font-bold text-amber-400">
            <LayoutGrid size={18} />
            <span>Карточки проектів</span>
            <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              {filteredCards.length} / {cards.length}
            </span>
          </div>
        </div>

        {/* Права частина тулбару: Пошук, Оновлення, Налаштування */}
        <div className="flex items-center gap-2.5">
          {/* Пошук */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук проекту..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
            />
          </div>

          {/* Кнопка оновлення */}
          <button
            onClick={fetchData}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 text-xs font-semibold ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Оновити дані"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-amber-400' : ''} />
            <span className="hidden sm:inline">Оновити</span>
          </button>

          {/* Кнопка налаштувань */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/90 text-white rounded-lg hover:bg-amber-600 transition-colors shadow border border-amber-500 text-xs font-semibold"
            title="Налаштування відображення пунктів карточки"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Налаштування</span>
          </button>
        </div>
      </header>

      {/* Помилка при завантаженні */}
      {error && (
        <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="underline hover:text-white font-bold ml-2">Спробувати знову</button>
        </div>
      )}

      {/* Сітка карток проектів */}
      <main className="farm-cards-scroll-area">
        {loading && cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <RefreshCw size={32} className="animate-spin text-amber-500" />
            <span className="text-sm font-semibold">Завантаження даних проектів...</span>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Search size={36} className="text-slate-600" />
            <span className="text-base font-bold text-slate-300">Проектів не знайдено</span>
            <span className="text-xs text-slate-500">Спробуйте змінити пошуковий запит</span>
          </div>
        ) : (
          <div
            className="farm-cards-grid-5"
            style={{
              gridTemplateColumns: settings.columnsCount !== 5 ? `repeat(${settings.columnsCount}, minmax(0, 1fr))` : undefined
            }}
          >
            {filteredCards.map(card => (
              <FarmCardItem
                key={card.projectName}
                card={card}
                settings={settings}
                elapsedSinceFetch={elapsedSinceFetch}
              />
            ))}
          </div>
        )}
      </main>

      {/* Модальне вікно налаштувань відображення */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl text-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-amber-400" />
                <h3 className="font-bold text-base text-white">Налаштування відображення карточок</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Оберіть пункти, які ви бажаєте бачити в кожній карточці проекту:
            </p>

            {/* Список перемикачів пунктів */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {[
                { key: 'showTitleHeader', label: '1. Назва проекту, Lvl, тип та розширення острова' },
                { key: 'showDeliveriesActivity', label: '2. Доставки за сьогодні (Coins/Flower/Ticket), допомога гравцям, міні-ігри' },
                { key: 'showCrops', label: '3. Рослини на грядках та сумарний урожай із таймером' },
                { key: 'showSeasonalCropSeeds', label: '4. Насіння рослин поточного сезону в інвентарі' },
                { key: 'showFruitTrees', label: '5. Фруктові дерева (квадрати зі зборами, урожаєм та рамкою)' },
                { key: 'showSeasonalFruitSeeds', label: '6. Насіння фруктових дерев поточного сезону в інвентарі' },
                { key: 'showChickens', label: '7. Кури в курятнику (квадратики: рівень, сон, піклування, стан)' },
                { key: 'showResources', label: '8. Ресурси для збору (дерево, камінь, залізо тощо з таймерами)' },
                { key: 'showTools', label: '9. Інструменти (в інвентарі та на складі)' },
                { key: 'showFlowers', label: '10. Квітки що ростуть із таймером дозрівання' },
                { key: 'showSeasonalFlowerSeeds', label: '11. Насіння квітів поточного сезону в інвентарі' },
                { key: 'showCooking', label: '12. Страви що готуються у будівлях із таймерами' },
                { key: 'showComposters', label: '13. 3 компостери (квадрати з кольоровими рамками статусу)' },
                { key: 'showBigFruits', label: '14. Великі фрукти Project на острові (прогрес 16/25)' },
                { key: 'showFishing', label: '15. Риболовля (спроби дня, вудки, наживка)' },
                { key: 'showIslandUpgrade', label: '16. Ресурси та рівень для покращення острова' },
              ].map(item => {
                const isChecked = (settings as any)[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => saveSettings({ ...settings, [item.key]: !isChecked })}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors text-xs"
                  >
                    <span className={isChecked ? 'text-slate-200 font-medium' : 'text-slate-400'}>
                      {item.label}
                    </span>
                    {isChecked ? (
                      <CheckSquare size={16} className="text-amber-400 flex-shrink-0 ml-2" />
                    ) : (
                      <Square size={16} className="text-slate-500 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Вибір колонок */}
            <div className="pt-3 border-t border-slate-800 mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-400">Колонок в ряд на широкому екрані:</span>
              <div className="flex gap-1.5">
                {[3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    onClick={() => saveSettings({ ...settings, columnsCount: num })}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                      settings.columnsCount === num
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Нижні кнопки модалки */}
            <div className="pt-3 border-t border-slate-800 mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allTrue: any = { ...settings };
                    Object.keys(DEFAULT_SETTINGS).forEach(k => {
                      if (k.startsWith('show')) allTrue[k] = true;
                    });
                    saveSettings(allTrue);
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  Увімкнути все
                </button>
                <button
                  type="button"
                  onClick={() => saveSettings(DEFAULT_SETTINGS)}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  Скинути
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow"
              >
                Зберегти та закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Внутрішній компонент карточки одного проекту
// ============================================================================
interface FarmCardItemProps {
  card: FarmCardData;
  settings: CardSettings;
  elapsedSinceFetch: number;
}

const FarmCardItem: React.FC<FarmCardItemProps> = ({ card, settings, elapsedSinceFetch }) => {
  return (
    <div className="farm-card">
      {/* 1. Назва проекту, Lvl, тип та розширення острова */}
      {settings.showTitleHeader && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/80 gap-1.5">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="font-extrabold text-sm text-amber-400 truncate" title={card.projectName}>
              {card.projectName}
            </span>
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded">
              Lvl {card.level}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 text-[10px] text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <span className="capitalize">{card.islandType}</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">L{card.islandExpansions}</span>
          </div>
        </div>
      )}

      {/* 2. Доставки за типами, допомога гравцям, міні-ігри */}
      {settings.showDeliveriesActivity && (
        <div className="farm-card-section">
          <div className="flex items-center justify-between">
            {/* Доставки за кольорами */}
            <div className="flex items-center gap-1">
              {/* Грошові (жовтий) */}
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold badge-delivery-coins"
                title="Виконано грошових замовлень за сьогодні (Coins / SFL)"
              >
                🪙 {card.deliveries.coins}
              </span>
              {/* Flower (фіолетовий) */}
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold badge-delivery-flower"
                title="Виконано квіткових замовлень за сьогодні (Flower)"
              >
                🌸 {card.deliveries.flower}
              </span>
              {/* Треті (синій / квитки) */}
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold badge-delivery-ticket"
                title="Виконано замовлень квитків / івентів за сьогодні (Ticket)"
              >
                🎫 {card.deliveries.ticket}
              </span>
            </div>

            {/* Допомога іншим гравцям */}
            <div
              className="text-[10px] font-semibold text-slate-300"
              title="Допомога друзям сьогодні (макс. 5)"
            >
              🤝 <span className={card.helpedPlayers.current >= card.helpedPlayers.max ? 'text-emerald-400' : 'text-slate-300'}>
                {card.helpedPlayers.current}/{card.helpedPlayers.max}
              </span>
            </div>

            {/* Міні-ігри */}
            <div
              className="text-[10px] font-semibold text-slate-300"
              title="Пройдені міні-ігри з призами"
            >
              🎮 <span className={card.minigames.completed >= card.minigames.total ? 'text-emerald-400' : 'text-amber-400'}>
                {card.minigames.completed}/{card.minigames.total}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Рослини на грядках і скільки буде при зборі + таймер */}
      {settings.showCrops && card.crops.length > 0 && (
        <div className="farm-card-section">
          <div className="space-y-1">
            {card.crops.map((crop, idx) => {
              const liveRemaining = Math.max(0, crop.remainingMs - elapsedSinceFetch);
              const isReady = liveRemaining === 0;

              return (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(crop.name)}.png`)}
                      alt={crop.name}
                      onError={handleImageErrorWithCacheBust}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="text-slate-300">{crop.name}</span>
                    <span className="font-bold text-amber-300">= {crop.totalAmount}</span>
                  </div>

                  <span className={isReady ? 'timer-badge-ready' : 'timer-badge-waiting'}>
                    {formatRemaining(liveRemaining)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Насіння рослин пори року що залишилися в інвентарі */}
      {settings.showSeasonalCropSeeds && card.seasonalCropSeeds.length > 0 && (
        <div className="farm-card-section">
          <div className="flex flex-wrap gap-1.5">
            {card.seasonalCropSeeds.map((seed, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60">
                <img
                  src={getCleanImageUrl(`/api/im/${encodeURIComponent(seed.name)}.png`)}
                  alt={seed.name}
                  onError={handleImageErrorWithCacheBust}
                  className="w-3.5 h-3.5 object-contain"
                  title={seed.name}
                />
                <span className="text-[10px] font-bold text-emerald-300">= {seed.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Фруктові дерева (квадрати: зліва зверху - збори, знизу справа - урожай, рамка зелена/сіра, таймер) */}
      {settings.showFruitTrees && card.fruitTrees.length > 0 && (
        <div className="farm-card-section">
          <div className="flex flex-wrap gap-1.5">
            {card.fruitTrees.map(tree => {
              const liveRemaining = Math.max(0, tree.remainingMs - elapsedSinceFetch);
              const isDead = tree.isDead || tree.harvestsLeft <= 0;
              const isReady = !isDead && liveRemaining === 0;

              return (
                <div key={tree.id} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`farm-square-box ${isDead ? 'opacity-50 border-not-ready' : isReady ? 'border-ready' : 'border-not-ready'}`}
                    title={`${tree.name}: залишилось зборів: ${tree.harvestsLeft}, урожай: ${tree.amount}, статус: ${isDead ? 'Дерево сухе (зрубати)' : isReady ? 'Готово до збору' : formatRemaining(liveRemaining)}`}
                  >
                    {/* Зверху зліва: скільки разів ще можна збирати */}
                    <span className="tree-harvests-left">{tree.harvestsLeft}</span>

                    {/* По центру: зображення фрукта */}
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(tree.name)}.png`)}
                      alt={tree.name}
                      onError={handleImageErrorWithCacheBust}
                      className="w-4 h-4 object-contain"
                    />

                    {/* Знизу справа: скільки дасть при зборі */}
                    <span className="tree-amount-yield">{tree.amount}</span>
                  </div>

                  {/* Таймер до дозрівання фруктового дерева */}
                  <span className={isDead ? 'timer-badge-waiting text-[8px] text-rose-400' : isReady ? 'timer-badge-ready text-[8px]' : 'timer-badge-waiting text-[8px]'}>
                    {isDead ? 'Сухе' : formatRemaining(liveRemaining)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Насіння фруктових дерев поточного сезону в інвентарі */}
      {settings.showSeasonalFruitSeeds && card.seasonalFruitSeeds && card.seasonalFruitSeeds.length > 0 && (
        <div className="farm-card-section">
          <div className="flex flex-wrap gap-1.5">
            {card.seasonalFruitSeeds.map((seed, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60">
                <img
                  src={getCleanImageUrl(`/api/im/${encodeURIComponent(seed.name)}.png`)}
                  alt={seed.name}
                  onError={handleImageErrorWithCacheBust}
                  className="w-3.5 h-3.5 object-contain"
                  title={seed.name}
                />
                <span className="text-[10px] font-bold text-amber-300">= {seed.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Кури в курятнику */}
      {settings.showChickens && card.chickens && card.chickens.length > 0 && (
        <div className="farm-card-section">
          <div className="flex flex-wrap gap-1.5">
            {card.chickens.map(chicken => {
              const liveSleepRemaining = Math.max(0, chicken.sleepRemainingMs - elapsedSinceFetch);
              const liveCareRemaining = Math.max(0, chicken.careRemainingMs - elapsedSinceFetch);
              const isSleeping = liveSleepRemaining > 0;
              const isSick = chicken.isSick;
              const canCare = liveCareRemaining === 0;

              let stateBorderClass = 'border-slate-700';
              let stateIcon = '🌾';
              let stateText = 'Хоче їсти';

              if (isSick) {
                stateBorderClass = 'border-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]';
                stateIcon = '🩹';
                stateText = 'Слаба / хвора';
              } else if (isSleeping) {
                stateBorderClass = 'border-indigo-500/70';
                stateIcon = '💤';
                stateText = 'Спить';
              } else {
                stateBorderClass = 'border-amber-500/80 shadow-[0_0_5px_rgba(245,158,11,0.25)]';
                stateIcon = '🌾';
                stateText = 'Хоче їсти (прокинулась)';
              }

              return (
                <div
                  key={chicken.id}
                  className={`chicken-square-card ${stateBorderClass}`}
                  title={`Курка #${chicken.id} | Рівень: ${chicken.level} (${chicken.experience} XP) | Стан: ${stateText} | Іграшка: ${chicken.desiredItem} | Пробудження: ${isSleeping ? formatRemaining(liveSleepRemaining) : 'Прокинулась'} | Піклування: ${canCare ? 'Готова' : formatRemaining(liveCareRemaining)}`}
                >
                  {/* Верхній рядок: Рівень та іконка стану */}
                  <div className="w-full flex items-center justify-between px-0.5">
                    <span className="chicken-level-badge">L{chicken.level}</span>
                    <span className="chicken-status-icon" title={stateText}>{stateIcon}</span>
                  </div>

                  {/* Центр: курка + бажана іграшка */}
                  <div className="relative flex items-center justify-center my-0.5">
                    <img
                      src={getCleanImageUrl('/api/im/Chicken.png')}
                      alt="Chicken"
                      onError={handleImageErrorWithCacheBust}
                      className={`w-5 h-5 object-contain ${isSleeping ? 'opacity-70' : 'opacity-100'}`}
                    />
                    {chicken.desiredItem && (
                      <div
                        className="absolute -bottom-1 -right-1.5 bg-slate-900 rounded-full p-0.5 border border-slate-700 shadow"
                        title={`Бажає: ${chicken.desiredItem}`}
                      >
                        <img
                          src={getCleanImageUrl(`/api/im/${encodeURIComponent(chicken.desiredItem)}.png`)}
                          alt={chicken.desiredItem}
                          onError={handleImageErrorWithCacheBust}
                          className="w-3 h-3 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Таймер до пробудження */}
                  <div className="w-full text-center leading-none">
                    <span
                      className={`chicken-timer-sub block truncate ${
                        isSleeping ? 'text-indigo-300' : 'text-amber-300'
                      }`}
                      title={isSleeping ? `До пробудження: ${formatRemaining(liveSleepRemaining)}` : 'Прокинулась, хоче їсти'}
                    >
                      {isSleeping ? formatRemaining(liveSleepRemaining) : 'Їсти'}
                    </span>
                  </div>

                  {/* Таймер до піклування */}
                  <div className="w-full text-center leading-none mt-0.5 border-t border-slate-800/80 pt-0.5">
                    <span
                      className={`chicken-timer-sub block truncate ${
                        canCare ? 'text-emerald-400 font-bold' : 'text-slate-400'
                      }`}
                      title={canCare ? 'Готова до піклування' : `Час до піклування: ${formatRemaining(liveCareRemaining)}`}
                    >
                      {canCare ? '❤️ Готова' : `❤️ ${formatRemaining(liveCareRemaining)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Ресурси для збору (дерево, камінь, залізо тощо: 4/9 і час до відновлення) */}
      {settings.showResources && card.resources.length > 0 && (
        <div className="farm-card-section">
          <div className="grid grid-cols-2 gap-1.5">
            {card.resources.map(res => {
              const liveRemaining = Math.max(0, res.remainingMs - elapsedSinceFetch);
              const allReady = res.readyCount >= res.totalCount;

              return (
                <div key={res.name} className="flex items-center justify-between bg-slate-800/80 px-1.5 py-1 rounded border border-slate-700/50">
                  <div className="flex items-center gap-1">
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(res.name)}.png`)}
                      alt={res.name}
                      onError={handleImageErrorWithCacheBust}
                      className="w-4 h-4 object-contain"
                      title={res.name}
                    />
                    <span className="font-bold text-[10px] text-slate-200">
                      {res.readyCount}/{res.totalCount}
                    </span>
                  </div>

                  <span className={allReady ? 'timer-badge-ready text-[9px]' : 'timer-badge-waiting text-[9px]'}>
                    {allReady ? 'Всі' : formatRemaining(liveRemaining)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Інструменти в інвентарі та на складі */}
      {settings.showTools && card.tools.length > 0 && (
        <div className="farm-card-section">
          <div className="flex flex-wrap gap-1.5">
            {card.tools.map(tool => (
              <div
                key={tool.name}
                className="flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60"
                title={`${tool.name}: в інвентарі ${tool.inventoryCount}, на складі ${tool.stockCount}`}
              >
                <img
                  src={getCleanImageUrl(`/api/im/${encodeURIComponent(tool.name)}.png`)}
                  alt={tool.name}
                  onError={handleImageErrorWithCacheBust}
                  className="w-3.5 h-3.5 object-contain"
                />
                <span className="text-[10px] font-bold text-slate-200">
                  <span className="text-amber-300">{tool.inventoryCount}</span>
                  <span className="text-slate-500"> / </span>
                  <span className="text-sky-300">{tool.stockCount}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Квітки що ростуть */}
      {settings.showFlowers && card.growingFlowers.length > 0 && (
        <div className="farm-card-section">
          <div className="space-y-1">
            {card.growingFlowers.map((flower, idx) => {
              const liveRemaining = Math.max(0, flower.remainingMs - elapsedSinceFetch);
              const isReady = liveRemaining === 0;

              return (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(flower.name)}.png`)}
                      alt={flower.name}
                      onError={handleImageErrorWithCacheBust}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="text-slate-300 truncate max-w-[120px]" title={flower.name}>
                      {flower.name}
                    </span>
                  </div>

                  <span className={isReady ? 'timer-badge-ready' : 'timer-badge-waiting'}>
                    {formatRemaining(liveRemaining)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. Насіння квітів поточного сезону в інвентарі */}
      {settings.showSeasonalFlowerSeeds && card.seasonalFlowerSeeds.length > 0 && (
        <div className="farm-card-section">
          <div className="flex flex-wrap gap-1.5">
            {card.seasonalFlowerSeeds.map((seed, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-slate-800/90 px-1.5 py-0.5 rounded border border-purple-900/40">
                <img
                  src={getCleanImageUrl(`/api/im/${encodeURIComponent(seed.name)}.png`)}
                  alt={seed.name}
                  onError={handleImageErrorWithCacheBust}
                  className="w-3.5 h-3.5 object-contain"
                  title={seed.name}
                />
                <span className="text-[10px] font-bold text-purple-300">= {seed.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10. Страви які зараз готуються */}
      {settings.showCooking && card.cookingDishes.length > 0 && (
        <div className="farm-card-section">
          <div className="space-y-1">
            {card.cookingDishes.map((dish, idx) => {
              const liveRemaining = Math.max(0, dish.remainingMs - elapsedSinceFetch);
              const isReady = liveRemaining === 0;

              return (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(dish.name)}.png`)}
                      alt={dish.name}
                      onError={handleImageErrorWithCacheBust}
                      className="w-4 h-4 object-contain"
                    />
                    <div className="flex flex-col">
                      <span className="text-slate-200 font-medium truncate max-w-[110px]" title={dish.name}>
                        {dish.name}
                      </span>
                      <span className="text-[9px] text-slate-500">{dish.buildingName}</span>
                    </div>
                  </div>

                  <span className={isReady ? 'timer-badge-ready' : 'timer-badge-waiting'}>
                    {formatRemaining(liveRemaining)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 11. 3 компостери (квадрат з кольоровою рамкою) */}
      {settings.showComposters && (
        <div className="farm-card-section">
          <div className="flex justify-around items-center pt-0.5">
            {card.composters.map(comp => {
              const liveRemaining = Math.max(0, (comp.remainingMs || 0) - elapsedSinceFetch);
              let borderClass = 'composter-gray';
              let statusText = 'Готовий до роботи';

              if (comp.status === 'ready') {
                borderClass = 'composter-green';
                statusText = 'Готово до збору';
              } else if (comp.status === 'producing') {
                borderClass = 'composter-yellow';
                statusText = `Йде процес: ${formatRemaining(liveRemaining)}`;
              } else if (comp.status === 'idle_missing_resources') {
                borderClass = 'composter-red';
                statusText = 'Не вистачає ресурсів для запуску';
              }

              return (
                <div key={comp.name} className="flex flex-col items-center gap-0.5" title={`${comp.name}: ${statusText}`}>
                  <div className={`farm-square-box ${borderClass}`}>
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(comp.name)}.png`)}
                      alt={comp.name}
                      onError={handleImageErrorWithCacheBust}
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                  <span className="text-[8px] text-slate-400 truncate max-w-[48px] text-center">
                    {comp.name.replace(' Composter', '').replace(' Bin', '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 12. Великі фрукти Project на острові */}
      {settings.showBigFruits && card.bigFruitProjects.length > 0 && (
        <div className="farm-card-section">
          <div className="space-y-1.5">
            {card.bigFruitProjects.map((proj, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50">
                <div className="flex items-center gap-1.5">
                  <img
                    src={getCleanImageUrl(`/api/im/${encodeURIComponent(proj.name)}.png`)}
                    alt={proj.name}
                    onError={handleImageErrorWithCacheBust}
                    className="w-4 h-4 object-contain"
                  />
                  <span className="text-slate-200 font-medium truncate max-w-[100px]" title={proj.name}>
                    {proj.name}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`font-bold text-[11px] ${proj.isCompleted ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {proj.cheers}/{proj.goal}
                  </span>
                  {proj.isCompleted && <span className="text-emerald-400 text-xs">✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 13. Риболовля (спроби 10/30, вудки, наживка) */}
      {settings.showFishing && (
        <div className="farm-card-section">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300">
              Сьогодні: <span className="font-bold text-sky-400">{card.fishing.dailyAttempts}/{card.fishing.dailyLimit}</span>
            </span>

            {/* Вудки */}
            <div className="flex items-center gap-1" title="Вудки в інвентарі">
              <img
                src={getCleanImageUrl('/api/im/Rod.png')}
                alt="Rod"
                onError={handleImageErrorWithCacheBust}
                className="w-4 h-4 object-contain"
              />
              <span className="font-bold text-amber-300">= {card.fishing.rodsCount}</span>
            </div>
          </div>

          {/* Наживка */}
          {card.fishing.baits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800">
              {card.fishing.baits.map(bait => (
                <div key={bait.name} className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/50">
                  <img
                    src={getCleanImageUrl(`/api/im/${encodeURIComponent(bait.name)}.png`)}
                    alt={bait.name}
                    onError={handleImageErrorWithCacheBust}
                    className="w-3.5 h-3.5 object-contain"
                    title={bait.name}
                  />
                  <span className="text-[10px] font-bold text-amber-300">= {bait.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 14. Ресурси для розширення/покращення острова (Lvl, ресурси) */}
      {settings.showIslandUpgrade && card.islandUpgrade && (
        <div
          className="farm-card-section bg-gradient-to-r from-slate-900 to-indigo-950/40 border-indigo-900/50"
          title={card.islandUpgrade.tooltip || undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
            {/* Острів / Ціль */}
            <div className="flex items-center gap-1">
              <span className="text-indigo-400 font-semibold text-[10px]">
                {card.islandUpgrade.targetLabel || (
                  card.islandUpgrade.isMaxLevel
                    ? '🏝️ Desert (макс. рівень)'
                    : card.islandUpgrade.isLastUpgrade
                    ? '🏝️ → Desert (останнє покращення)'
                    : `🏝️ → ${card.islandUpgrade.nextIslandType}`
                )}
              </span>
            </div>

            {!card.islandUpgrade.isMaxLevel && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Рівень бампкіна */}
                <div className="flex items-center gap-0.5">
                  <span className="text-slate-400 text-[10px]">Lvl:</span>
                  <span
                    className={`font-bold text-[10px] ${
                      card.islandUpgrade.currentLevel >= card.islandUpgrade.requiredLevel
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {card.islandUpgrade.currentLevel}/{card.islandUpgrade.requiredLevel}
                  </span>
                </div>

                {/* Ресурси для розширення */}
                {card.islandUpgrade.resources && card.islandUpgrade.resources.length > 0 ? (
                  card.islandUpgrade.resources.map((res: any) => (
                    <div
                      key={res.name}
                      className="flex items-center gap-0.5"
                      title={`${res.name}: ${res.current}/${res.required}`}
                    >
                      <img
                        src={getCleanImageUrl(`/api/im/${encodeURIComponent(res.name)}.png`)}
                        alt={res.name}
                        onError={handleImageErrorWithCacheBust}
                        className="w-3.5 h-3.5 object-contain"
                      />
                      <span
                        className={`font-bold text-[10px] ${
                          res.isReady ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {res.current}/{res.required}
                      </span>
                    </div>
                  ))
                ) : card.islandUpgrade.resourceName ? (
                  <div className="flex items-center gap-0.5">
                    <img
                      src={getCleanImageUrl(`/api/im/${encodeURIComponent(card.islandUpgrade.resourceName)}.png`)}
                      alt={card.islandUpgrade.resourceName}
                      onError={handleImageErrorWithCacheBust}
                      className="w-3.5 h-3.5 object-contain"
                      title={card.islandUpgrade.resourceName}
                    />
                    <span
                      className={`font-bold text-[10px] ${
                        card.islandUpgrade.currentResource >= card.islandUpgrade.requiredResource
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {card.islandUpgrade.currentResource}/{card.islandUpgrade.requiredResource}
                    </span>
                  </div>
                ) : null}

                {/* Монети (якщо потрібні) */}
                {Boolean(card.islandUpgrade.coinsRequired && card.islandUpgrade.coinsRequired > 0) && (
                  <div
                    className="flex items-center gap-0.5"
                    title={`Coins: ${Math.floor(card.islandUpgrade.coinsCurrent || 0)}/${card.islandUpgrade.coinsRequired}`}
                  >
                    <img
                      src={getCleanImageUrl('/api/im/coins.png')}
                      alt="Coins"
                      onError={handleImageErrorWithCacheBust}
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span
                      className={`font-bold text-[10px] ${
                        (card.islandUpgrade.coinsCurrent || 0) >= (card.islandUpgrade.coinsRequired || 0)
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {Math.floor(card.islandUpgrade.coinsCurrent || 0)}/{card.islandUpgrade.coinsRequired}
                    </span>
                  </div>
                )}

                {card.islandUpgrade.canUpgrade && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded border border-emerald-500/40 animate-pulse">
                    Готово!
                  </span>
                )}
              </div>
            )}

            {card.islandUpgrade.isMaxLevel && (
              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded border border-emerald-500/30">
                Макс. рівень
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmCardsOverview;
