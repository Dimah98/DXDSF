import React, { useState, useEffect, useCallback } from 'react';
// Імпортуємо іконки з бібліотеки lucide-react для нашого UI інтерфейсу
// Імпортуємо іконки з бібліотеки lucide-react для нашого UI інтерфейсу (Copy — для копіювання нод)
import { Save, FilePlus, ScrollText, Settings, X, Search, Trash2, Play, Clock, CalendarClock, Monitor, Wifi, User, ChevronRight, TrendingUp, Copy, Sparkles, ChevronDown } from 'lucide-react';
import { useLaunchSettings } from '../hooks/useLaunchSettings';
import { StatisticsModal } from './StatisticsModal';
// Імпортуємо компонент для автоматичного створення проекту з профілем ITBrowser
import AutoCreateModal from './AutoCreateModal';
import RunHistoryModal from './RunHistoryModal';

// Імпортуємо GlobalSettings щоб відкривати через кнопку
interface ProjectManagerModalProps {
  isOpen: boolean;              // Чи показувати вікно
  onClose: () => void;          // Закрити модалку
  currentProject: string | null;// Поточний проект
  onNew: () => void;            // Новий проект
  onSave: (asNew?: boolean) => void; // Зберегти
  onLoad: (name: string) => void;    // Завантажити проект
  onSettingsToggle: () => void;      // Відкрити GlobalSettings
  onGlobalStatsToggle?: () => void;  // Відкрити загальну статистику
  onOpenBrowser?: (name: string) => void; // Відкрити браузер проекту
}

// Дні тижня для розкладу
const DAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Рядок одного проекту в лівому блоці
const ProjectRow = ({
  name, isCurrent, isSelected, isChecked, isRunning, activeNodeTitle, isBrowserOpen,
  onSelect, onLoad, onOpenSettings, onToggleCheck, onOpenBrowser
}: {
  name: string; isCurrent: boolean; isSelected: boolean; isChecked: boolean;
  isRunning: boolean; activeNodeTitle: string | null; isBrowserOpen?: boolean;
  onSelect: () => void; onLoad: () => void; onOpenSettings: (type: 'settings' | 'stats' | 'runs') => void;
  onToggleCheck: () => void; onOpenBrowser?: () => void;
}) => (
  <div
    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer group ${
      isRunning
        ? 'bg-emerald-950/40 border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/40'
        : isSelected
          ? 'bg-indigo-500/20 border border-indigo-500/40'
          : 'hover:bg-muted/30 border border-transparent'
    }`}
    onClick={onSelect}
  >
    {/* Прапорець вибору проекту для групового запуску/зупинки */}
    <input
      type="checkbox"
      checked={isChecked}
      onChange={(e) => {
        e.stopPropagation(); // Зупиняємо спливання кліку на весь рядок
        onToggleCheck(); // Перемикаємо прапорець виділення
      }}
      className="w-4 h-4 rounded border-slate-700 text-indigo-500 bg-slate-800/80 shrink-0 cursor-pointer focus:ring-indigo-500/50 focus:ring-2 transition-all mr-1"
    />

    {/* Світлодіод-індикатор статусу роботи проекту */}
    <div 
      className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
        isRunning
          ? 'bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse ring-2 ring-emerald-500/50'
          : isBrowserOpen
            ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]'
            : 'bg-red-500/40 border border-red-500/20'
      }`} 
      title={isRunning ? 'Бот запущений та працює' : isBrowserOpen ? 'Браузер відкритий' : 'Бот зупинено'}
    />

    {/* Назва проекту */}
    <span className={`text-[12px] font-bold truncate w-24 shrink-0 ${
      isRunning
        ? 'text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]'
        : isCurrent
          ? 'text-indigo-400'
          : 'text-slate-200'
    }`}>
      {name} {isCurrent && <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1 rounded border border-indigo-500/20 ml-1">Редактор</span>}
    </span>

    {/* Відображення поточної виконуваної ноди або статусу */}
    <div className={`flex items-center gap-1 flex-1 min-w-0 rounded-lg px-2 py-0.5 ${isRunning ? 'bg-emerald-950/50 border border-emerald-500/50' : 'bg-slate-900/40 border border-slate-700/30'}`}>
      <Search size={10} className={`${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} shrink-0`} />
      <span className={`text-[10px] truncate font-mono ${isRunning ? 'text-emerald-300 font-bold animate-pulse' : 'text-slate-500'}`}>
        {isRunning ? (activeNodeTitle || 'Старт сценарію...') : 'Зупинено'}
      </span>
    </div>

    {/* Кнопка історії запусків (синя) */}
    <button
      onClick={e => { e.stopPropagation(); onOpenSettings('runs'); }}
      className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      title="Історія запусків"
    >
      <ScrollText size={12} />
    </button>

    {/* Кнопка статистики (рожева) */}
    <button
      onClick={e => { e.stopPropagation(); onOpenSettings('stats'); }}
      className="p-1.5 bg-pink-500/20 hover:bg-pink-500/40 text-pink-400 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      title="Статистика"
    >
      <TrendingUp size={12} />
    </button>

    {/* Кнопка налаштувань (фіолетова) */}
    <button
      onClick={e => { e.stopPropagation(); onOpenSettings('settings'); }}
      className="p-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      title="Налаштування проекту"
    >
      <Settings size={12} />
    </button>

    {/* Кнопка відкриття браузера проекту (смарагдова, світиться якщо запущений) */}
    <button
      onClick={e => {
        e.stopPropagation();
        onOpenBrowser?.();
      }}
      className={`p-1.5 rounded-lg transition-all shrink-0 ${
        isBrowserOpen
          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,1)] border border-emerald-300 ring-2 ring-emerald-400 opacity-100 animate-pulse font-bold scale-105'
          : 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 opacity-0 group-hover:opacity-100'
      }`}
      title={isBrowserOpen ? "Браузер проекту запущений! (Клікніть для перегляду)" : "Відкрити браузер проекту"}
    >
      <Monitor size={12} className={isBrowserOpen ? "drop-shadow" : ""} />
    </button>

    {/* Кнопка завантаження в активний редактор (синя) */}
    <button
      onClick={e => { e.stopPropagation(); onLoad(); }}
      className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      title="Завантажити в редактор"
    >
      <ChevronRight size={12} />
    </button>
  </div>
);

const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen, onClose, currentProject, onNew, onSave, onLoad, onSettingsToggle, onGlobalStatsToggle, onOpenBrowser
}) => {
  const [projects, setProjects] = useState<string[]>([]);
  // Який проект вибрано у списку (для правої панелі)
  const [selectedProject, setSelectedProject] = useState<string | null>(currentProject);
  // Правa панель відкрита чи ні
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [runsModalOpen, setRunsModalOpen] = useState(false);

  // Стейт для збереження списку назв виділених проектів (для групових дій)
  const [checkedProjects, setCheckedProjects] = useState<string[]>([]);
  // Стейт для збереження карти статусів роботи та активних нод усіх сесій проектів
  const [projectStatuses, setProjectStatuses] = useState<Record<string, { isRunning: boolean; activeNodeTitle: string | null; isBrowserOpen?: boolean }>>({});

  // Стейт для відкриття/закриття модалки авто-створення проекту з профілем ITBrowser
  const [autoCreateOpen, setAutoCreateOpen] = useState(false);

  // Стейт для збереження списку профілів ITBrowser (завантажується з API)
  const [itbrowserProfiles, setItbrowserProfiles] = useState<{ id: string; hasUserData: boolean; hasFingerprint: boolean }[]>([]);

  // Налаштування запуску зі збереженням у localStorage (per-project)
  const { settings: launch, update: updateLaunch, toggleDay } = useLaunchSettings(selectedProject);

  // Функція для завантаження поточних статусів проектів із бекенду
  const fetchProjectStatuses = useCallback(async () => {
    try {
      // Робимо HTTP GET запит до нашого ендпоінту статусів
      const res = await fetch('/api/projects/status');
      // Якщо відповідь успішна — парсимо JSON та оновлюємо стейт статусів
      if (res.ok) {
        // Отримуємо об'єкт статусів від сервера
        const data = await res.json();
        // Записуємо отримані статуси в стейт компонента
        setProjectStatuses(data);
      }
    } catch {
      // Опрацьовуємо помилку запиту без виведення в консоль
    }
  }, []);

  // Ефект для регулярного інтервального опитування статусів роботи проектів, коли модалка відкрита
  useEffect(() => {
    // Перевіряємо чи відкрита модалка
    if (isOpen) {
      // Викликаємо функцію оновлення статусів відразу
      fetchProjectStatuses();
      // Налаштовуємо інтервал опитування кожні 2000 мс (2 секунди)
      const interval = setInterval(fetchProjectStatuses, 2000);
      // Очищаємо інтервал при демонтажі компонента або закритті модалки
      return () => clearInterval(interval);
    }
    return undefined;
  // Перезапускаємо ефект при зміні стану відкритості або функції завантаження статусів
  }, [isOpen, fetchProjectStatuses]);

  // Функція для зміни стану виділення одного конкретного проекту
  const handleToggleCheck = (projectName: string) => {
    // Оновлюємо стейт виділених проектів
    setCheckedProjects(prev =>
      // Якщо проект вже є у масиві — видаляємо його, інакше додаємо в масив
      prev.includes(projectName)
        ? prev.filter(p => p !== projectName)
        : [...prev, projectName]
    );
  };

  // Функція для виділення всіх наявних у списку проектів
  const handleCheckAll = () => {
    // Записуємо у стейт повний список проектів
    setCheckedProjects([...projects]);
  };

  // Функція для зняття виділення з усіх проектів
  const handleClearSelection = () => {
    // Очищаємо масив виділених проектів повністю
    setCheckedProjects([]);
  };

  // Функція для групового запуску всіх виділених проектів
  const handleRunMultiple = async () => {
    // Перевіряємо чи є вибрані проекти у списку
    if (checkedProjects.length === 0) return;
    try {
      const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};

      // Збираємо browserSettings для кожного вибраного проекту з localStorage
      // Це потрібно, щоб бекенд відкрив правильний профіль, а не дефолтний
      const projectSettings: Record<string, any> = {};
      // Перебираємо всі вибрані проекти
      for (const projName of checkedProjects) {
        // Формуємо ключ localStorage для цього проекту
        const storageKey = `sfl_browser_${projName}`;
        // Зчитуємо збережені налаштування браузера для цього проекту
        const savedBrowser = localStorage.getItem(storageKey);
        // Якщо налаштування знайдені — парсимо їх, інакше використовуємо порожній об'єкт
        const parsedBrowser = savedBrowser ? JSON.parse(savedBrowser) : {};
        
        delete parsedBrowser.photoDebug;
        delete parsedBrowser.snapToGrid;

        projectSettings[projName] = { ...globalSettings, ...parsedBrowser };
      }

      // Робимо POST запит до ендпоінту групового запуску
      const res = await fetch('/api/projects/run-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ projectNames: checkedProjects, projectSettings })
      });
      if (res.ok) {
        fetchProjectStatuses();
      }
    } catch {
      // Опрацьовуємо помилку без виведення в інтерфейс
    }
  };

  // Функція для послідовного запуску виділених проектів по черзі
  const handleRunSequential = async () => {
    // Перевіряємо чи є вибрані проекти у списку
    if (checkedProjects.length === 0) return;
    try {
      // Зчитуємо глобальні налаштування браузера з localStorage
      const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};

      // Збираємо browserSettings для кожного вибраного проекту з localStorage
      const projectSettings: Record<string, any> = {};
      for (const projName of checkedProjects) {
        const storageKey = `sfl_browser_${projName}`;
        const savedBrowser = localStorage.getItem(storageKey);
        const parsedBrowser = savedBrowser ? JSON.parse(savedBrowser) : {};

        delete parsedBrowser.photoDebug;
        delete parsedBrowser.snapToGrid;

        projectSettings[projName] = { ...globalSettings, ...parsedBrowser };
      }

      // Робимо POST запит до ендпоінту послідовного запуску
      const res = await fetch('/api/projects/run-sequential', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ projectNames: checkedProjects, projectSettings })
      });
      if (res.ok) {
        fetchProjectStatuses();
      }
    } catch {
      // Опрацьовуємо помилку без виведення в інтерфейс
    }
  };

  // Функція для групової зупинки всіх виділених проектів
  const handleStopMultiple = async () => {
    // Перевіряємо чи є вибрані проекти у списку
    if (checkedProjects.length === 0) return;
    try {
      // Робимо POST запит до ендпоінту групової зупинки
      const res = await fetch('/api/projects/stop-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ projectNames: checkedProjects })
      });
      if (res.ok) {
        fetchProjectStatuses();
      }
    } catch {
      // Опрацьовуємо помилку без виведення в інтерфейс
    }
  };

  // Стан завантаження під час операції копіювання нод між проектами
  const [isCopying, setIsCopying] = useState(false);

  // Функція для копіювання нод з поточного проекту у всі виділені проекти
  const handleCopyNodes = async () => {
    // Перевіряємо чи є поточний проект-джерело (той що відкритий у редакторі)
    if (!currentProject) return;
    // Перевіряємо чи є вибрані цільові проекти
    if (checkedProjects.length === 0) return;

    // Формуємо список цільових проектів (виключаємо поточний — немає сенсу копіювати сам у себе)
    const targets = checkedProjects.filter(p => p !== currentProject);
    // Якщо після фільтрації список порожній — повідомляємо користувача
    if (targets.length === 0) {
      alert('Серед вибраних проектів немає жодного відмінного від поточного.');
      return;
    }

    // Показуємо підтверджуючий діалог перед незворотньою операцією
    const confirmed = window.confirm(
      `⚠️ УВАГА! Ця дія незворотна!\n\n` +
      `Ноди та ребра з проекту «${currentProject}» будуть скопійовані в:\n` +
      `${targets.map(t => `• ${t}`).join('\n')}\n\n` +
      `Змінні кожного проекту збережуться без змін.\n\n` +
      `Продовжити?`
    );
    // Якщо користувач скасував — виходимо
    if (!confirmed) return;

    // Вмикаємо стан завантаження щоб заблокувати повторні кліки
    setIsCopying(true);
    try {
      // Робимо POST запит до ендпоінту копіювання нод
      const res = await fetch('/api/projects/copy-nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ sourceProject: currentProject, targetProjects: targets })
      });
      
      let result: any = {};
      try {
        result = await res.json();
      } catch (e) {
        throw new Error(`Помилка сервера (${res.status})`);
      }

      // Якщо запит успішний — показуємо результат
      if (res.ok && result.success) {
        // Формуємо повідомлення про кількість оновлених проектів
        const errorInfo = result.errors?.length > 0 ? `\nПомилки в: ${result.errors.join(', ')}` : '';
        alert(`✅ Ноди скопійовано в ${result.updated} проект(ів).${errorInfo}`);
      } else {
        // Відображаємо помилку від сервера
        alert(`❌ Помилка: ${result.error || 'Невідома помилка сервера'}`);
      }
    } catch (err: any) {
      // Відображаємо помилку запиту
      alert(`❌ Помилка: ${err?.message || 'Помилка з\'єднання. Перевірте чи запущений сервер.'}`);
    } finally {
      // Вимикаємо стан завантаження в будь-якому випадку
      setIsCopying(false);
    }
  };

  // Налаштування браузера (per-project) із підтримкою окремого поля для назви профілю та назви його директорії
  const [browserSettings, setBrowserSettings] = useState(() => {
    // Формуємо ключ для збереження в localStorage на основі назви вибраного проекту
    const key = `sfl_browser_${selectedProject || 'default'}`;
    // Зчитуємо раніше збережені налаштування з localStorage
    const saved = localStorage.getItem(key);
    // Якщо налаштування знайдені — парсимо їх, інакше повертаємо дефолтний об'єкт із порожніми значеннями профілів
    return saved ? JSON.parse(saved) : { width: 1280, height: 720, profile: '', profileDir: '', proxy: '', photoDebug: true, snapToGrid: true };
  });

  // Стейт для збереження дефолтних налаштувань профілю з сервера
  const [defaultBrowserEnv, setDefaultBrowserEnv] = useState({ defaultProfile: 'Default', defaultProfileDir: 'Default' });

  // Завантажуємо список проектів з API при відкритті
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      const filtered = Array.isArray(data) ? data.filter((name: string) => 
        name !== 'categories' &&
        name !== 'global_building_types' &&
        name !== 'schedule' &&
        name !== 'notifications' &&
        !name.endsWith('_layout') &&
        !name.endsWith('_save') &&
        !name.endsWith('_stats') &&
        !name.endsWith('_logs') &&
        !name.endsWith('_inventory')
      ) : [];
      filtered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      setProjects(filtered);
    } catch { }
  }, []);

  // Завантажуємо список профілів ITBrowser з API
  const fetchITBrowserProfiles = useCallback(async () => {
    try {
      // Робимо запит до ендпоінту для отримання існуючих профілів ITBrowser
      const res = await fetch('/api/itbrowser/profiles');
      if (res.ok) {
        const data = await res.json();
        // Зберігаємо список профілів у стейт компонента
        setItbrowserProfiles(data);
      }
    } catch {
      // Ігноруємо помилки завантаження профілів
    }
  }, []);

  // Завантажуємо проекти та дефолтні змінні профілю браузера при відкритті вікна
  useEffect(() => {
    // Перевіряємо чи модалка відкрита
    if (isOpen) {
      // Завантажуємо список усіх наявних проектів
      fetchProjects();
      // Завантажуємо список профілів ITBrowser для дропдауну
      fetchITBrowserProfiles();
      // Здійснюємо запит до сервера для отримання дефолтних налаштувань браузера з .env
      fetch('/api/browser-env')
        // Очікуємо на виконання запиту та конвертуємо його відповідь у JSON об'єкт
        .then(res => res.json())
        // Записуємо отримані дані про профіль у відповідний стейт компонента
        .then(data => setDefaultBrowserEnv(data))
        // Опрацьовуємо можливу помилку мережі без виведення помилок в інтерфейс
        .catch(() => {});
    }
  // Перезапускаємо ефект при зміні стану відкритості або функції завантаження проектів
  }, [isOpen, fetchProjects, fetchITBrowserProfiles]);

  // При зміні вибраного проекту — завантажуємо його налаштування браузера
  useEffect(() => {
    // Формуємо унікальний ключ для отримання налаштувань проекту з localStorage
    const key = `sfl_browser_${selectedProject || 'default'}`;
    // Читаємо збережене значення з пам'яті браузера
    const saved = localStorage.getItem(key);
    // Оновлюємо стейт налаштувань, заповнюючи profileDir за замовчуванням порожнім рядком, якщо налаштувань немає
    setBrowserSettings(saved ? JSON.parse(saved) : { width: 1280, height: 720, profile: '', profileDir: '', proxy: '', photoDebug: true, snapToGrid: true });
  // Перезапускаємо ефект щоразу при зміні selectedProject
  }, [selectedProject]);

  // Збереження налаштувань браузера
  const saveBrowserSettings = (newSettings: any) => {
    const updated = { ...browserSettings, ...newSettings };
    setBrowserSettings(updated);
    const key = `sfl_browser_${selectedProject || 'default'}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  // Видалення проекту
  const handleDelete = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Видалити проект "${name}"?`)) return;
    await fetch(`/api/projects/${name}`, { method: 'DELETE' });
    fetchProjects();
  };

  if (!isOpen) return null;

  return (
    // Overlay — прозорий, клік поза вікном закриває
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Контейнер двох блоків */}
      <div
        className="flex gap-4 w-full max-w-5xl h-[80vh] animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >

        {/* ═══════════════════════════════════════════
            ЛІВИЙ БЛОК — Список проектів
        ═══════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 rounded-2xl border bg-[var(--interface-bg)] border-[var(--interface-border)] backdrop-blur-md overflow-hidden">

          {/* Шапка з кнопками */}
          <div className="flex items-center gap-2 border-b border-white/10 shrink-0 p-3">
            {/* Зберегти (зелена) */}
            <button
              onClick={() => onSave(false)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--button-success-bg)] hover:bg-[var(--button-success-hover)] text-white text-[11px] font-black uppercase rounded-xl transition-all active:scale-95 shadow-lg shadow-green-900/40"
            >
              <Save size={13} />
              Зберегти
            </button>

            {/* Новий проект (сірий) */}
            <button
              onClick={onNew}
              className="p-2 bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover)] text-slate-200 rounded-xl transition-all active:scale-95"
              title="Новий порожній проект"
            >
              <FilePlus size={15} />
            </button>

            {/* Кнопка авто-створення проекту з профілем ITBrowser (фіолетова з іконкою зірочки) */}
            <button
              onClick={() => setAutoCreateOpen(true)}
              className="p-2 bg-gradient-to-br from-violet-600/30 to-indigo-600/30 hover:from-violet-600/50 hover:to-indigo-600/50 text-violet-300 hover:text-violet-200 rounded-xl transition-all active:scale-95 border border-violet-500/20 hover:border-violet-500/40"
              title="Авто-створити проект із новим профілем ITBrowser та проксі"
            >
              <Sparkles size={15} />
            </button>

            {/* Налаштування запуску (фіолетовий) */}
            <button
              onClick={() => setRightPanelOpen(true)}
              className={`p-2 rounded-xl transition-all active:scale-95 ${rightPanelOpen ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--accent-purple)]/30 hover:bg-[var(--accent-purple)]/50 text-[var(--accent-purple)]'}`}
              title="Налаштування запуску"
            >
              <Clock size={15} />
            </button>

            {/* Загальні налаштування (синій) */}
            <button
              onClick={() => { onSettingsToggle(); onClose(); }}
              className="p-2 bg-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/50 text-[var(--accent-blue)] rounded-xl transition-all active:scale-95"
              title="Загальні налаштування"
            >
              <Settings size={15} />
            </button>

            {/* Загальна статистика (фіолетовий) */}
            <button
              onClick={() => { onGlobalStatsToggle?.(); onClose(); }}
              className="p-2 bg-[var(--accent-purple)]/30 hover:bg-[var(--accent-purple)]/50 text-[var(--accent-purple)] rounded-xl transition-all active:scale-95"
              title="Загальна статистика"
            >
              <TrendingUp size={15} />
            </button>

            <div className="ml-auto">
              <button onClick={onClose} className="p-1.5 hover:bg-muted/30 text-slate-400 rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Панель групових дій для швидкого керування кількома проектами */}
          {projects.length > 0 && (
            // Контейнер панелі з рамкою та легким фоном
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-slate-900/20 shrink-0 text-[11px]">
              {/* Лівий блок: Кнопки виділення */}
              <div className="flex items-center gap-1.5">
                {/* Кнопка Вибрати всі */}
                <button
                  // Викликаємо функцію вибору всіх проектів при натисканні
                  onClick={handleCheckAll}
                  // Класи оформлення кнопки
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 font-bold rounded-lg transition-all active:scale-95 border border-slate-700/30"
                  // Підказка при наведенні
                  title="Виділити прапорцями всі наявні проекти"
                >
                  Вибрати всі
                </button>
                {/* Кнопка Зняти виділення (показується тільки коли є вибрані проекти) */}
                {checkedProjects.length > 0 && (
                  <button
                    // Викликаємо функцію очищення вибору при натисканні
                    onClick={handleClearSelection}
                    // Класи оформлення кнопки
                    className="px-2.5 py-1.5 bg-slate-800/40 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 font-medium rounded-lg transition-all active:scale-95 border border-slate-700/20"
                    // Підказка при наведенні
                    title="Зняти виділення з усіх обраних проектів"
                  >
                    Зняти ({checkedProjects.length})
                  </button>
                )}
              </div>

              {/* Правий блок: Запуск та зупинка вибраних проектів */}
              <div className="flex items-center gap-1.5">
                {/* Кнопка групового запуску */}
                <button
                  // Викликаємо функцію запуску вибраних при натисканні
                  onClick={handleRunMultiple}
                  // Робимо кнопку неактивною, якщо проекти не вибрано
                  disabled={checkedProjects.length === 0}
                  // Класи оформлення кнопки (підсвічуємо зеленою тінню, якщо є обрані)
                  className={`flex items-center gap-1 px-3 py-1.5 text-white font-bold rounded-lg transition-all active:scale-95 ${checkedProjects.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/50 cursor-pointer' : 'bg-slate-800/50 text-slate-500 border border-slate-700/20 cursor-not-allowed opacity-50'}`}
                  // Підказка при наведенні
                  title="Запустити всі вибрані проекти одночасно"
                >
                  {/* Іконка Play */}
                  <Play size={10} className="fill-current shrink-0" />
                  {/* Текст кнопки із вказанням кількості вибраних проектів */}
                  Запустити {checkedProjects.length > 0 ? `(${checkedProjects.length})` : ''}
                </button>

                {/* Кнопка послідовного запуску проектів по черзі */}
                <button
                  // Викликаємо функцію послідовного запуску при натисканні
                  onClick={handleRunSequential}
                  // Робимо кнопку неактивною, якщо проекти не вибрано
                  disabled={checkedProjects.length === 0}
                  // Класи оформлення кнопки (синьо-блакитний колір для відрізнення від паралельного запуску)
                  className={`flex items-center gap-1 px-3 py-1.5 text-white font-bold rounded-lg transition-all active:scale-95 ${checkedProjects.length > 0 ? 'bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-950/50 cursor-pointer' : 'bg-slate-800/50 text-slate-500 border border-slate-700/20 cursor-not-allowed opacity-50'}`}
                  // Підказка при наведенні
                  title="Запустити вибрані проекти по черзі: наступний стартує після завершення попереднього"
                >
                  {/* Іконка повторного відтворення — символізує послідовність */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19"/>
                  </svg>
                  {/* Текст кнопки із кількістю вибраних проектів */}
                  По черзі {checkedProjects.length > 0 ? `(${checkedProjects.length})` : ''}
                </button>

                {/* Кнопка групової зупинки */}
                <button
                  // Викликаємо функцію зупинки вибраних при натисканні
                  onClick={handleStopMultiple}
                  // Робимо кнопку неактивною, якщо проекти не вибрано
                  disabled={checkedProjects.length === 0}
                  // Класи оформлення кнопки (підсвічуємо червоною тінню, якщо є обрані)
                  className={`flex items-center gap-1 px-3 py-1.5 text-white font-bold rounded-lg transition-all active:scale-95 ${checkedProjects.length > 0 ? 'bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950/50 cursor-pointer' : 'bg-slate-800/50 text-slate-500 border border-slate-700/20 cursor-not-allowed opacity-50'}`}
                  // Підказка при наведенні
                  title="Зупинити всі вибрані проекти одночасно"
                >
                  {/* Символ зупинки */}
                  <span className="w-1.5 h-1.5 bg-current rounded-sm shrink-0" />
                  {/* Текст кнопки із вказанням кількості вибраних проектів */}
                  Зупинити {checkedProjects.length > 0 ? `(${checkedProjects.length})` : ''}
                </button>

                {/* Кнопка копіювання нод з поточного проекту у вибрані (активна лише коли є поточний проект та вибрані цілі) */}
                <button
                  // Викликаємо функцію копіювання нод при натисканні
                  onClick={handleCopyNodes}
                  // Блокуємо кнопку якщо немає поточного проекту, немає вибраних, або триває операція
                  disabled={!currentProject || checkedProjects.length === 0 || isCopying}
                  // Клас кнопки залежить від стану активності
                  className={`flex items-center gap-1 px-3 py-1.5 text-white font-bold rounded-lg transition-all active:scale-95 ${
                    currentProject && checkedProjects.length > 0 && !isCopying
                      ? 'bg-violet-600 hover:bg-violet-500 shadow-md shadow-violet-950/50 cursor-pointer'  // Активний стан — фіолетовий
                      : 'bg-slate-800/50 text-slate-500 border border-slate-700/20 cursor-not-allowed opacity-50' // Неактивний стан
                  }`}
                  // Підказка показує назву поточного проекту-джерела
                  title={currentProject
                    ? `Скопіювати ноди з «${currentProject}» у вибрані проекти (змінні збережуться)`
                    : 'Відкрийте проект-джерело в редакторі щоб копіювати його ноди'
                  }
                >
                  {/* Іконка копіювання або спіннер під час обробки */}
                  {isCopying
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" /> // Анімований спіннер
                    : <Copy size={10} className="shrink-0" />  // Іконка копіювання
                  }
                  {/* Текст кнопки — показуємо назву джерельного проекту */}
                  {isCopying ? 'Копіюємо...' : `Копіювати ноди → (${checkedProjects.filter(p => p !== currentProject).length})`}
                </button>
              </div>
            </div>
          )}

          {/* Список проектів */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">

            {/* Мітка "Старт" для поточного проекту */}
            {currentProject && (
              <div className="text-[9px] font-black uppercase text-green-400/70 tracking-widest px-3 mb-1">
                Старт
              </div>
            )}

            {projects.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic text-center py-8">
                Проектів не знайдено
              </div>
            ) : (
              projects.map(p => (
                <div key={p} className="relative group/row">
                  <ProjectRow
                    name={p}
                    isCurrent={p === currentProject}
                    isSelected={p === selectedProject}
                    // Передаємо чи виділено проект прапорцем
                    isChecked={checkedProjects.includes(p)}
                    // Передаємо стан чи запущений проект на основі статусів з сервера
                    isRunning={projectStatuses[p]?.isRunning || false}
                    // Передаємо назву останньої активної ноди
                    activeNodeTitle={projectStatuses[p]?.activeNodeTitle || null}
                    isBrowserOpen={projectStatuses[p]?.isBrowserOpen || false}
                    onSelect={() => setSelectedProject(p)}
                    onLoad={() => { onLoad(p); onClose(); }}
                    onOpenSettings={(type) => { 
                      setSelectedProject(p); 
                      if (type === 'settings') setRightPanelOpen(true);
                      else if (type === 'stats') setStatsModalOpen(true);
                      else if (type === 'runs') setRunsModalOpen(true);
                    }}
                    onOpenBrowser={() => {
                      onOpenBrowser?.(p);
                      onClose();
                    }}
                    // Передаємо колбек перемикання прапорця виділення
                    onToggleCheck={() => handleToggleCheck(p)}
                  />
                </div>
              ))
            )}

            {/* Підписи внизу списку */}
            <div className="pt-3 mt-3 border-t border-white/10 space-y-1 flex flex-col items-center justify-end">
              <p className="text-[9px] text-slate-500 px-3">↑ Відкриває вибраний проект</p>
              <p className="text-[9px] text-slate-500 px-3">🔍 Показує яка нода в проекті активна</p>
              <p className="text-[9px] text-slate-500 px-3">📊 Загальна статистика</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            ПРАВИЙ БЛОК — Налаштування (відкривається кнопкою)
        ═══════════════════════════════════════════ */}
        <div className={`flex flex-col rounded-2xl border bg-[var(--interface-bg)] border-[var(--interface-border)] backdrop-blur-md overflow-hidden transition-all duration-300 ${rightPanelOpen ? 'w-96 opacity-100' : 'w-0 opacity-0 border-0'}`}>
          {rightPanelOpen && (
            <>
              {/* Шапка правої панелі */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                <div>
                  <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Настройки проекта</p>
                  <p className="text-[12px] font-bold text-slate-200 mt-0.5">{selectedProject || 'Виберіть проект'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={e => selectedProject && handleDelete(e, selectedProject)} 
                    className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                    title="Видалити проект"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setRightPanelOpen(false)} className="p-1.5 hover:bg-muted/30 text-slate-400 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Контент правої панелі */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Секція: Налаштування запуску */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest flex items-center gap-2">
                    <CalendarClock size={13} />
                    Налаштування запуску
                  </p>

                  {/* Одинарний запуск */}
                  <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl hover:bg-muted/20 transition-colors">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${launch.mode === 'single' ? 'border-purple-500 bg-purple-500' : 'border-slate-600'}`}>
                      {launch.mode === 'single' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <input type="radio" className="hidden" checked={launch.mode === 'single'} onChange={() => updateLaunch('mode', 'single')} />
                    <div className="flex items-center gap-2">
                      <Play size={13} className="text-green-400" />
                      <span className="text-[12px] font-bold text-slate-200">Одинарний запуск</span>
                    </div>
                  </label>

                  {/* Запуск кожні n часу */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-xl hover:bg-muted/20 transition-colors">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${launch.mode === 'interval' ? 'border-purple-500 bg-purple-500' : 'border-slate-600'}`}>
                      {launch.mode === 'interval' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <input type="radio" className="hidden" checked={launch.mode === 'interval'} onChange={() => updateLaunch('mode', 'interval')} />
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-amber-400" />
                        <span className="text-[12px] font-bold text-slate-200">Запуск кожні n часу</span>
                      </div>
                      {launch.mode === 'interval' && (
                        <div className="flex items-center gap-2 ml-1">
                          <input
                            type="number" min={1} value={launch.intervalValue}
                            onChange={e => updateLaunch('intervalValue', parseInt(e.target.value) || 1)}
                            className="w-16 bg-muted/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground text-center outline-none focus:ring-1 ring-purple-500"
                          />
                          <select
                            value={launch.intervalUnit}
                            onChange={e => updateLaunch('intervalUnit', e.target.value as any)}
                            className="bg-muted/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:ring-1 ring-purple-500"
                          >
                            <option value="minutes">хвилин</option>
                            <option value="hours">годин</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Запуск за розкладом */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-xl hover:bg-muted/20 transition-colors">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${launch.mode === 'schedule' ? 'border-purple-500 bg-purple-500' : 'border-slate-600'}`}>
                      {launch.mode === 'schedule' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <input type="radio" className="hidden" checked={launch.mode === 'schedule'} onChange={() => updateLaunch('mode', 'schedule')} />
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <CalendarClock size={13} className="text-blue-400" />
                        <span className="text-[12px] font-bold text-slate-200">Запуск за розкладом</span>
                      </div>
                      {launch.mode === 'schedule' && (
                        <div className="flex flex-col gap-2 ml-1">
                          <input
                            type="time" value={launch.scheduleTime}
                            onChange={e => updateLaunch('scheduleTime', e.target.value)}
                            className="bg-muted/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:ring-1 ring-purple-500 w-fit"
                          />
                          {/* Дні тижня */}
                          <div className="flex gap-1">
                            {DAYS.map((day, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => toggleDay(i)}
                                className={`w-7 h-7 rounded-lg text-[9px] font-black transition-colors ${launch.scheduleDays.includes(i) ? 'bg-purple-600 text-white' : 'bg-muted/40 text-slate-500 hover:bg-muted/60'}`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                <div className="h-px bg-white/10" />

                {/* Секція: Налаштування браузера */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-2">
                    <Monitor size={13} />
                    Налаштування браузера
                  </p>

                  {/* Розмір вікна */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 px-1">Розширення вікна браузера</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" value={browserSettings.width}
                        onChange={e => saveBrowserSettings({ width: parseInt(e.target.value) || 1280 })}
                        className="flex-1 bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-blue-500"
                        placeholder="Ширина"
                      />
                      <span className="text-slate-500 text-[11px]">×</span>
                      <input
                        type="number" value={browserSettings.height}
                        onChange={e => saveBrowserSettings({ height: parseInt(e.target.value) || 720 })}
                        className="flex-1 bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-blue-500"
                        placeholder="Висота"
                      />
                    </div>
                  </div>

                  {/* Профіль браузера (назва) */}
                  <div className="space-y-1">
                    {/* Текстовий заголовок з іконкою користувача */}
                    <p className="text-[10px] text-slate-400 px-1 flex items-center gap-1.5">
                      {/* Відображаємо іконку користувача */}
                      <User size={10} />
                      {/* Текст підпису для поля назви профілю */}
                      Назва профілю (itbrowser, наприклад: SF)
                    </p>
                    {/* Поле вводу для назви профілю */}
                    <input
                      // Тип поля — звичайний текст
                      type="text"
                      // Значення назви профілю з налаштувань
                      value={browserSettings.profile || ''}
                      // Записуємо нову назву профілю при зміні
                      onChange={e => saveBrowserSettings({ profile: e.target.value })}
                      // Задаємо стилі для інпуту
                      className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-blue-500"
                      // Плейсхолдер з інформацією про дефолтне ім'я профілю з сервера
                      placeholder={defaultBrowserEnv.defaultProfile ? `За замовчуванням (${defaultBrowserEnv.defaultProfile})` : 'Назва профілю...'}
                    />
                  </div>

                  {/* Директорія профілю (назва папки в userData) — дропдаун + ручне введення */}
                  <div className="space-y-1">
                    {/* Заголовок секції */}
                    <p className="text-[10px] text-slate-400 px-1 flex items-center gap-1.5">
                      <User size={10} />
                      Папка профілю (profile-directory)
                    </p>

                    {/* Дропдаун вибору існуючого профілю ITBrowser з пулу */}
                    {itbrowserProfiles.length > 0 && (
                      <div className="relative">
                        <select
                          // При виборі профілю із списку — оновлюємо і profileDir і profile
                          onChange={e => {
                            const val = e.target.value;
                            if (val) {
                              // Записуємо ID профілю одночасно у два поля налаштувань
                              saveBrowserSettings({ profileDir: val, profile: val });
                            }
                          }}
                          // Дефолтне значення — поточна директорія профілю або порожня
                          value={browserSettings.profileDir || ''}
                          // Стилі дропдауну
                          className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-blue-500 pr-8 appearance-none"
                        >
                          {/* Порожній варіант (використати дефолтний) */}
                          <option value="">{defaultBrowserEnv.defaultProfileDir ? `Дефолт (${defaultBrowserEnv.defaultProfileDir})` : 'Виберіть профіль...'}</option>
                          {/* Перебираємо всі профілі з ITBrowser та відображаємо як options */}
                          {itbrowserProfiles.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.id}
                              {p.hasFingerprint ? ' ✓FP' : ''}
                              {p.hasUserData ? '' : ' (тільки FP)'}
                            </option>
                          ))}
                        </select>
                        {/* Іконка стрілки для дропдауну */}
                        <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    )}

                    {/* Поле ручного введення назви директорії профілю */}
                    <input
                      type="text"
                      value={browserSettings.profileDir || ''}
                      onChange={e => saveBrowserSettings({ profileDir: e.target.value })}
                      className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-blue-500"
                      placeholder={defaultBrowserEnv.defaultProfileDir ? `За замовчуванням (${defaultBrowserEnv.defaultProfileDir})` : 'Наприклад: 20260521103945'}
                    />
                  </div>

                  {/* Зведена інформація про активний профіль та папку */}
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                    {/* Інформація про назву профілю */}
                    <div className="text-[10px] text-indigo-400 flex justify-between">
                      {/* Опис поля */}
                      <span>Активний профіль:</span>
                      {/* Значення з підсвічуванням */}
                      <span className="font-bold text-indigo-300">
                        {browserSettings.profile && browserSettings.profile.trim() !== '' 
                          ? browserSettings.profile 
                          : `${defaultBrowserEnv.defaultProfile} (дефолт)`}
                      </span>
                    </div>
                    {/* Інформація про папку профілю */}
                    <div className="text-[10px] text-indigo-400 flex justify-between">
                      {/* Опис поля */}
                      <span>Папка профілю:</span>
                      {/* Значення з підсвічуванням */}
                      <span className="font-bold text-indigo-300">
                        {browserSettings.profileDir && browserSettings.profileDir.trim() !== '' 
                          ? browserSettings.profileDir 
                          : `${defaultBrowserEnv.defaultProfileDir} (дефолт)`}
                      </span>
                    </div>
                  </div>

                  {/* Проксі */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 px-1 flex items-center gap-1.5">
                      <Wifi size={10} />
                      Проксі (для кожного проекту окремий)
                    </p>
                    <input
                      type="text" value={browserSettings.proxy}
                      onChange={e => saveBrowserSettings({ proxy: e.target.value })}
                      className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-blue-500"
                      placeholder="http://user:pass@host:port"
                    />
                  </div>
                </div>


              </div>

              {/* Кнопка "Потім" знизу */}
              <div className="p-4 border-t border-white/10 shrink-0">
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-black uppercase rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-900/40 tracking-widest"
                >
                  Потім
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <StatisticsModal 
        isOpen={statsModalOpen} 
        onClose={() => setStatsModalOpen(false)} 
        projectName={selectedProject || ''} 
      />

      {/* Модалка автоматичного створення проекту з профілем ITBrowser та проксі */}
      <RunHistoryModal
          isOpen={runsModalOpen}
          onClose={() => setRunsModalOpen(false)}
          projectName={selectedProject || ''}
        />
        <AutoCreateModal
        isOpen={autoCreateOpen}          // Чи відкрита модалка
        onClose={() => setAutoCreateOpen(false)}  // Закрити модалку
        existingProjects={projects}      // Передаємо список проектів для авто-нумерації
        onCreated={(newName) => {
          // Після успішного створення — оновлюємо список проектів
          fetchProjects();
          // Також оновлюємо список профілів ITBrowser (новий профіль вже є)
          fetchITBrowserProfiles();
        }}
      />
    </div>
  );
};

export default ProjectManagerModal;
