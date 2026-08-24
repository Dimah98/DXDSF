import React, { useState, useEffect, useCallback } from 'react';
// Імпортуємо іконки для UI компонента (Copy та Key — для відображення даних гаманця)
import { X, Sparkles, Wifi, User, AlertCircle, CheckCircle2, Loader2, Globe, RefreshCw, Copy, Key } from 'lucide-react';

// Інтерфейс пропсів компонента AutoCreateModal
interface AutoCreateModalProps {
  isOpen: boolean;           // Чи показувати модальне вікно
  onClose: () => void;       // Callback для закриття вікна
  existingProjects: string[]; // Список існуючих проектів для авто-нумерації
  onCreated: (projectName: string) => void; // Callback після успішного створення
}

// Тип для опцій вибору проксі
type ProxyMode = 'none' | 'manual' | 'pool';

// Інтерфейс об'єкта проксі з пулу
interface ProxyItem {
  proxy: string; // Рядок проксі-сервера
  used: boolean; // Чи вже прив'язаний до проекту
}

// Інтерфейс результату налаштування Ronin Wallet
interface WalletResult {
  walletAddress: string;  // Адреса Ronin гаманця (ronin:0x...)
  seedPhrase: string;     // Сид-фраза (12 слів)
  walletSetup: boolean;   // Чи було успішно налаштовано гаманець
}

// Допоміжна функція для генерації наступної назви проекту (SF11, SF12...)
// Аналізує існуючі проекти і знаходить найбільший номер, щоб запропонувати наступний
function getNextProjectName(existingProjects: string[]): string {
  // Шукаємо всі проекти що відповідають формату SF + число
  const sfPattern = /^SF(\d+)$/;
  let maxNum = 0;

  // Перебираємо всі існуючі проекти та шукаємо максимальний номер
  for (const p of existingProjects) {
    const match = p.match(sfPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num; // Оновлюємо максимум
    }
  }

  // Повертаємо назву з наступним номером
  return `SF${maxNum + 1}`;
}

// Допоміжна функція для генерації timestamp ID (формат: YYYYMMDDHHMMSS)
// Використовується для попереднього перегляду ID профілю що буде створений
function generateTimestampId(): string {
  const now = new Date();
  // Формуємо рядок з частин дати та часу, кожен з двозначним форматом
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
}

// Основний компонент AutoCreateModal
const AutoCreateModal: React.FC<AutoCreateModalProps> = ({
  isOpen, onClose, existingProjects, onCreated
}) => {
  // Назва нового проекту (з авто-пропозицією)
  const [projectName, setProjectName] = useState('');
  // Режим вибору проксі (none, manual, pool)
  const [proxyMode, setProxyMode] = useState<ProxyMode>('pool');
  // Вручну введений проксі
  const [manualProxy, setManualProxy] = useState('');
  // Вибраний проксі з пулу
  const [selectedPoolProxy, setSelectedPoolProxy] = useState('');
  // Список проксі з пулу (завантажується з API)
  const [poolProxies, setPoolProxies] = useState<ProxyItem[]>([]);
  // Поточний ID профілю що буде створений (preview)
  const [previewProfileId, setPreviewProfileId] = useState(generateTimestampId());
  // Стан завантаження даних пулу проксі
  const [loadingProxies, setLoadingProxies] = useState(false);
  // Стан виконання операції створення
  const [creating, setCreating] = useState(false);
  // Повідомлення про результат (успіх або помилка)
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Дані налаштованого Ronin Wallet (якщо успішно)
  const [walletResult, setWalletResult] = useState<WalletResult | null>(null);
  // Стан копіювання сід-фрази у буфер обміну
  const [copiedSeed, setCopiedSeed] = useState(false);
  // Стан копіювання адреси гаманця у буфер обміну
  const [copiedAddr, setCopiedAddr] = useState(false);

  // При відкритті модалки — ініціалізуємо поля з дефолтними значеннями
  useEffect(() => {
    if (isOpen) {
      // Встановлюємо авто-запропоновану назву проекту
      setProjectName(getNextProjectName(existingProjects));
      // Оновлюємо preview ID профілю
      setPreviewProfileId(generateTimestampId());
      // Очищаємо повідомлення про результат
      setResultMsg(null);
      // Очищаємо дані гаманця з попереднього створення
      setWalletResult(null);
      // Скидаємо стани копіювання
      setCopiedSeed(false);
      setCopiedAddr(false);
      // Скидаємо вибраний проксі з пулу
      setSelectedPoolProxy('');
    }
  }, [isOpen, existingProjects]);

  // Оновлюємо preview ID профілю кожну секунду (поки модалка відкрита)
  useEffect(() => {
    if (!isOpen) return;
    // Запускаємо інтервал оновлення секунди
    const interval = setInterval(() => {
      setPreviewProfileId(generateTimestampId());
    }, 1000);
    // Прибираємо інтервал при закритті або розмонтуванні
    return () => clearInterval(interval);
  }, [isOpen]);

  // Завантажуємо список проксі з API при відкритті модалки
  const fetchProxies = useCallback(async () => {
    setLoadingProxies(true); // Вмикаємо індикатор завантаження
    try {
      // Запитуємо список проксі з бекенду
      const res = await fetch('/api/itbrowser/proxies');
      if (res.ok) {
        const data = await res.json();
        setPoolProxies(data); // Зберігаємо список у стейт

        // Автоматично вибираємо перший вільний проксі
        const firstFree = data.find((p: ProxyItem) => !p.used);
        if (firstFree) {
          setSelectedPoolProxy(firstFree.proxy);
        }
      }
    } catch {
      // Ігноруємо помилки завантаження — список просто буде порожній
    } finally {
      setLoadingProxies(false); // Вимикаємо індикатор завантаження
    }
  }, []);

  // Запускаємо завантаження проксі при відкритті
  useEffect(() => {
    if (isOpen) {
      fetchProxies();
    }
  }, [isOpen, fetchProxies]);

  // Визначаємо реальне значення проксі що буде передане в API
  const resolvedProxy = proxyMode === 'none'
    ? ''                          // Без проксі — порожній рядок
    : proxyMode === 'manual'
      ? manualProxy               // Вручну введений проксі
      : selectedPoolProxy;        // Вибраний з пулу

  // Обробник натискання кнопки "Створити проект"
  const handleCreate = async () => {
    // Перевіряємо що введено назву проекту
    if (!projectName.trim()) {
      setResultMsg({ type: 'error', text: 'Введіть назву проекту' });
      return;
    }

    // Перевіряємо що проекту з такою назвою ще немає
    if (existingProjects.includes(projectName.trim())) {
      setResultMsg({ type: 'error', text: `Проект "${projectName}" вже існує` });
      return;
    }

    // Перевіряємо що вибрано проксі (якщо вибраний режим "з пулу")
    if (proxyMode === 'pool' && !selectedPoolProxy) {
      setResultMsg({ type: 'error', text: 'Виберіть проксі з пулу або оберіть інший режим' });
      return;
    }

    // Вмикаємо стан завантаження та очищаємо попередні повідомлення
    setCreating(true);
    setResultMsg(null);

    try {
      // Відправляємо запит на створення проекту до бекенду
      const res = await fetch('/api/projects/create-with-profile', {
        method: 'POST',                                        // Метод POST
        headers: { 'Content-Type': 'application/json' },      // JSON заголовок
        body: JSON.stringify({
          projectName: projectName.trim(),                     // Назва проекту
          proxy: resolvedProxy || undefined                    // Проксі (або undefined)
        })
      });

      // Парсимо відповідь сервера
      const data = await res.json();

      if (res.ok && data.success) {
        // Успішно створено — зберігаємо дані гаманця якщо вони є
        if (data.walletSetup && data.walletAddress) {
          setWalletResult({
            walletAddress: data.walletAddress,
            seedPhrase: data.seedPhrase || '',
            walletSetup: true
          });
        }

        // Показуємо повідомлення про успіх
        setResultMsg({
          type: 'success',
          text: `✅ Проект "${data.projectName}" створено! Профіль: ${data.profileId}${data.proxy ? `, проксі: призначено` : ''}${data.walletSetup ? ` · Ronin Wallet налаштовано` : ''}`
        });

        // Зберігаємо browserSettings у localStorage для цього проекту
        const localKey = `sfl_browser_${data.projectName}`;
        const localSettings = {
          width: 1280,
          height: 720,
          profile: data.profileId,      // Профіль ITBrowser
          profileDir: data.profileDir,  // Папка профілю
          proxy: data.proxy || '',      // Проксі-сервер
          photoDebug: true,
          snapToGrid: true
        };
        localStorage.setItem(localKey, JSON.stringify(localSettings));

        // Повідомляємо батьківський компонент через 5 секунд (щоб встигли скопіювати сід-фразу)
        setTimeout(() => {
          onCreated(data.projectName); // Передаємо назву нового проекту
          onClose();                   // Закриваємо модалку
        }, 5000);
      } else {
        // Помилка від сервера — показуємо повідомлення
        setResultMsg({ type: 'error', text: data.error || 'Невідома помилка сервера' });
      }
    } catch {
      // Мережева помилка
      setResultMsg({ type: 'error', text: 'Помилка з\'єднання з сервером' });
    } finally {
      // Вимикаємо індикатор завантаження
      setCreating(false);
    }
  };

  // Якщо модалка закрита — нічого не рендеримо
  if (!isOpen) return null;

  // Рахуємо кількість вільних проксі в пулі
  const freeProxiesCount = poolProxies.filter(p => !p.used).length;

  return (
    // Overlay — клік поза вікном закриває модалку
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Вікно модалки — стоп пропагація кліку */}
      <div
        className="w-full max-w-md rounded-2xl border bg-[var(--interface-bg)] border-[var(--interface-border)] backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка модалки з заголовком та кнопкою закриття */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Іконка з градієнтним фоном */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              {/* Заголовок */}
              <p className="text-[13px] font-black text-white">Авто-створення проекту</p>
              {/* Підзаголовок */}
              <p className="text-[10px] text-slate-400">Новий профіль ITBrowser + проксі</p>
            </div>
          </div>
          {/* Кнопка закриття модалки */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Тіло модалки */}
        <div className="p-4 space-y-4">

          {/* Поле для введення назви проекту */}
          <div className="space-y-1.5">
            {/* Мітка поля */}
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <span>Назва проекту</span>
            </label>
            {/* Поле введення */}
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)} // Оновлюємо стейт при зміні
              placeholder="Наприклад: SF11"
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[13px] text-white font-bold outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Секція вибору проксі */}
          <div className="space-y-2">
            {/* Мітка секції */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Wifi size={10} />
                <span>Проксі-сервер</span>
              </label>
              {/* Кількість вільних проксі в пулі */}
              {poolProxies.length > 0 && (
                <span className="text-[9px] text-emerald-400 font-bold">
                  {freeProxiesCount} вільних / {poolProxies.length} всього
                </span>
              )}
            </div>

            {/* Варіанти вибору проксі */}
            <div className="space-y-1.5">

              {/* Варіант 1: Без проксі */}
              <label
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                  proxyMode === 'none'
                    ? 'bg-slate-700/50 border-slate-500/50'
                    : 'border-transparent hover:bg-slate-800/40'
                }`}
              >
                {/* Кастомна радіо-кнопка */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  proxyMode === 'none' ? 'border-slate-400 bg-slate-400' : 'border-slate-600'
                }`}>
                  {proxyMode === 'none' && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                </div>
                <input
                  type="radio"
                  className="hidden"
                  checked={proxyMode === 'none'}
                  onChange={() => setProxyMode('none')} // Вибираємо режим "без проксі"
                />
                <span className="text-[12px] text-slate-300 font-medium">Без проксі</span>
              </label>

              {/* Варіант 2: Вибір з пулу */}
              <label
                className={`flex flex-col gap-2 p-2.5 rounded-xl cursor-pointer transition-all border ${
                  proxyMode === 'pool'
                    ? 'bg-emerald-950/40 border-emerald-500/30'
                    : 'border-transparent hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Кастомна радіо-кнопка */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    proxyMode === 'pool' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
                  }`}>
                    {proxyMode === 'pool' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <input
                    type="radio"
                    className="hidden"
                    checked={proxyMode === 'pool'}
                    onChange={() => setProxyMode('pool')} // Вибираємо режим "з пулу"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Globe size={12} className="text-emerald-400 shrink-0" />
                    <span className="text-[12px] text-slate-200 font-medium">Вибрати з пулу Webshare</span>
                    {/* Кнопка оновлення списку проксі */}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); fetchProxies(); }}
                      className="ml-auto p-1 hover:bg-emerald-500/20 text-emerald-400/60 hover:text-emerald-400 rounded-lg transition-colors"
                      title="Оновити список проксі"
                    >
                      <RefreshCw size={10} className={loadingProxies ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Дропдаун вибору конкретного проксі (показується лише в режимі 'pool') */}
                {proxyMode === 'pool' && (
                  <div className="ml-7">
                    {loadingProxies ? (
                      // Індикатор завантаження
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Loader2 size={10} className="animate-spin" />
                        Завантаження...
                      </div>
                    ) : poolProxies.length === 0 ? (
                      // Повідомлення про відсутність проксі
                      <p className="text-[11px] text-rose-400">Файл proxies.txt порожній або недоступний</p>
                    ) : (
                      // Дропдаун із проксі
                      <select
                        value={selectedPoolProxy}
                        onChange={e => setSelectedPoolProxy(e.target.value)} // Оновлюємо вибраний проксі
                        className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[11px] text-emerald-300 font-mono outline-none focus:ring-1 ring-emerald-500"
                      >
                        {/* Порожній варіант */}
                        <option value="">-- Виберіть проксі --</option>
                        {/* Список проксі: вільні вгорі, зайняті знизу */}
                        {poolProxies
                          .sort((a, b) => (a.used ? 1 : 0) - (b.used ? 1 : 0)) // Вільні — першими
                          .map(({ proxy, used }) => (
                            <option
                              key={proxy}
                              value={proxy}
                              disabled={used} // Зайняті проксі вимкнені у дропдауні
                            >
                              {used ? `🔒 (зайнятий) ` : `✅ `}{proxy}
                            </option>
                          ))
                        }
                      </select>
                    )}
                  </div>
                )}
              </label>

              {/* Варіант 3: Ввести вручну */}
              <label
                className={`flex flex-col gap-2 p-2.5 rounded-xl cursor-pointer transition-all border ${
                  proxyMode === 'manual'
                    ? 'bg-blue-950/40 border-blue-500/30'
                    : 'border-transparent hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Кастомна радіо-кнопка */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    proxyMode === 'manual' ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                  }`}>
                    {proxyMode === 'manual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <input
                    type="radio"
                    className="hidden"
                    checked={proxyMode === 'manual'}
                    onChange={() => setProxyMode('manual')} // Вибираємо режим "вручну"
                  />
                  <span className="text-[12px] text-slate-200 font-medium">Ввести вручну</span>
                </div>

                {/* Поле вводу для ручного проксі */}
                {proxyMode === 'manual' && (
                  <div className="ml-7">
                    <input
                      type="text"
                      value={manualProxy}
                      onChange={e => setManualProxy(e.target.value)} // Оновлюємо ручний проксі
                      placeholder="http://user:pass@host:port"
                      className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[11px] text-blue-300 font-mono outline-none focus:ring-1 ring-blue-500"
                    />
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Секція інформації про профіль ITBrowser */}
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 space-y-2">
            {/* Заголовок секції */}
            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
              <User size={10} />
              Профіль ITBrowser
            </p>

            {/* Деталі профілю що буде створений */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Тип профілю:</span>
                {/* Мітка типу профілю */}
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Новий анонімний (чистий)
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">ID профілю (preview):</span>
                {/* ID профілю що буде створений (оновлюється щосекунди) */}
                <span className="text-indigo-300 font-mono font-bold">{previewProfileId}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Fingerprint:</span>
                {/* Повідомлення про рандомний fingerprint */}
                <span className="text-violet-300 font-bold">Рандомний (canvas, WebGL, UA...)</span>
              </div>
            </div>
          </div>

          {/* Повідомлення про результат (успіх або помилка) */}
          {resultMsg && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-[11px] font-medium animate-in fade-in duration-300 ${
              resultMsg.type === 'success'
                ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/50 border border-rose-500/30 text-rose-300'
            }`}>
              {/* Іконка статусу */}
              {resultMsg.type === 'success'
                ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-400" />
                : <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
              }
              {/* Текст повідомлення */}
              <span>{resultMsg.text}</span>
            </div>
          )}

          {/* Блок даних Ronin Wallet — відображається після успішного створення */}
          {walletResult && walletResult.walletSetup && (
            <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-500">
              {/* Заголовок секції */}
              <div className="flex items-center gap-2">
                {/* Іконка ключа */}
                <Key size={12} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                  Ronin Wallet — збережіть дані!
                </span>
              </div>

              {/* Адреса гаманця */}
              {walletResult.walletAddress && (
                <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-2.5 space-y-1">
                  <span className="text-[9px] font-bold uppercase text-amber-500/70 tracking-wider block">
                    Адреса гаманця
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    {/* Адреса у форматі ronin:0x... */}
                    <span className="text-amber-300 font-mono text-[10px] break-all flex-1">
                      {walletResult.walletAddress}
                    </span>
                    {/* Кнопка копіювання адреси */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(walletResult.walletAddress);
                        setCopiedAddr(true);
                        // Скидаємо стан через 2 секунди
                        setTimeout(() => setCopiedAddr(false), 2000);
                      }}
                      className="shrink-0 p-1.5 hover:bg-amber-500/20 rounded-lg transition-colors"
                      title="Копіювати адресу"
                    >
                      {copiedAddr
                        ? <CheckCircle2 size={12} className="text-emerald-400" />
                        : <Copy size={12} className="text-amber-400" />
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Сід-фраза (12 слів) */}
              {walletResult.seedPhrase && (
                <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-rose-500/70 tracking-wider">
                      Сід-фраза (12 слів) — ⚠️ зберігайте в безпечному місці!
                    </span>
                    {/* Кнопка копіювання сід-фрази */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(walletResult.seedPhrase);
                        setCopiedSeed(true);
                        // Скидаємо стан через 2 секунди
                        setTimeout(() => setCopiedSeed(false), 2000);
                      }}
                      className="shrink-0 p-1.5 hover:bg-rose-500/20 rounded-lg transition-colors"
                      title="Копіювати сід-фразу"
                    >
                      {copiedSeed
                        ? <CheckCircle2 size={12} className="text-emerald-400" />
                        : <Copy size={12} className="text-rose-400" />
                      }
                    </button>
                  </div>
                  {/* Сітка з 12 слів сід-фрази */}
                  <div className="grid grid-cols-3 gap-1">
                    {walletResult.seedPhrase.split(' ').map((word, i) => (
                      <div
                        key={i}
                        className="bg-rose-900/20 border border-rose-500/10 rounded-lg px-2 py-1 text-[10px] font-mono flex items-center gap-1"
                      >
                        {/* Номер слова */}
                        <span className="text-rose-600 text-[9px] font-bold w-3 shrink-0">{i + 1}.</span>
                        {/* Саме слово */}
                        <span className="text-rose-200 font-semibold">{word}</span>
                      </div>
                    ))}
                  </div>
                  {/* Пароль гаманця */}
                  <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-rose-500/10">
                    <span className="text-rose-500/60">Пароль гаманця:</span>
                    <span className="text-rose-300 font-mono font-bold">Ronin123!@#</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Нижня панель з кнопками дій */}
        <div className="flex items-center gap-2 p-4 border-t border-white/10">
          {/* Кнопка скасування */}
          <button
            onClick={onClose}
            disabled={creating} // Блокуємо під час створення
            className="flex-1 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-[12px] font-bold uppercase rounded-xl transition-all active:scale-95 border border-slate-700/30"
          >
            Скасувати
          </button>

          {/* Кнопка створення проекту */}
          <button
            onClick={handleCreate}
            disabled={creating || !projectName.trim()} // Блокуємо якщо немає назви або йде запит
            className={`flex-1 py-2.5 text-white text-[12px] font-black uppercase rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
              creating || !projectName.trim()
                ? 'bg-violet-700/30 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-900/50'
            }`}
          >
            {creating ? (
              // Спіннер під час виконання
              <>
                <Loader2 size={13} className="animate-spin" />
                Створюємо...
              </>
            ) : (
              // Нормальний стан кнопки
              <>
                <Sparkles size={13} />
                Створити проект →
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoCreateModal;
