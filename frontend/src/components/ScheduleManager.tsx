import React, { useState, useEffect } from 'react';
// Імпортуємо необхідні іконки з бібліотеки Lucide React для інтерфейсу
import { X, Calendar as CalendarIcon, Save } from 'lucide-react';
// Імпортуємо базовий компонент текстового вводу з нашої UI-системної бібліотеки
import { Input } from './ui/input';

// Описуємо інтерфейс для структури запланованого програмного запуску
interface ScheduledRun {
  projectName: string; // Назва проекту, до якого належить цей запуск
  runAt: number;       // Час запланованого запуску у мілісекундах
  source: string;      // Джерело запуску (наприклад, 'node' або 'interval')
  randomOffset?: number; // Додаткове випадкове відхилення для інтервалу
}

// Описуємо інтерфейс для повної інформації про розклад окремого проекту
interface ScheduleInfo {
  projectName: string;  // Назва проекту
  mode: string;         // Режим розкладу (none, single, interval)
  nextRun: number | null; // Час наступного регулярного запуску
  lastRun: number;      // Час останнього завершеного запуску
  settings: any;        // Збережені налаштування інтервалу та зміщення
  plannedRuns: ScheduledRun[]; // Масив запланованих програмних запусків від нод
}

// Головний компонент Менеджера розкладу, що відображає таймлайн та налаштування
export default function ScheduleManager({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  // Стейт для зберігання повного списку розкладів проектів від сервера
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  // Стейт для відстеження процесу мережевого завантаження даних
  const [loading, setLoading] = useState(false);
  // Стейт для виділеного проекту, чиї налаштування ми зараз редагуємо
  const [selectedProject, setSelectedProject] = useState<ScheduleInfo | null>(null);

  // Стейт для форми вибору режиму запуску проекту (none / interval)
  const [editMode, setEditMode] = useState<string>('none');
  // Стейт форми для числового значення періоду запуску
  const [editIntervalValue, setEditIntervalValue] = useState<number>(2);
  // Стейт форми для одиниці виміру періоду (хвилин або годин)
  const [editIntervalUnit, setEditIntervalUnit] = useState<string>('hours');
  // Стейт форми для максимального відхилення запуску у хвилинах (рандомізація)
  const [editRandomOffsetMinutes, setEditRandomOffsetMinutes] = useState<number>(0);

  // Функція для завантаження актуального розкладу з REST API бекенду
  const fetchSchedule = async () => {
    // Активуємо індикатор завантаження даних
    setLoading(true);
    try {
      // Здійснюємо HTTP GET запит до ендпоінту отримання розкладу
      const res = await fetch('/api/schedule');
      // Якщо відповідь успішна
      if (res.ok) {
        // Парсимо JSON-масив отриманих розкладів проектів
        const data = await res.json();
        // Оновлюємо стейт компонента списком розкладів
        setSchedules(data);
      }
    } catch (e) {
      // Логуємо помилку у разі невдалого з'єднання або помилки сервера
      console.error(e);
    }
    // Деактивуємо індикатор завантаження даних
    setLoading(false);
  };

  // Ефект для первинного завантаження та регулярного автооновлення кожні 30 секунд
  useEffect(() => {
    // Якщо вікно відкрито
    if (isOpen) {
      // Завантажуємо дані розкладу
      fetchSchedule();
      // Налаштовуємо інтервал автооновлення розкладу
      const interval = setInterval(fetchSchedule, 30000);
      // Очищаємо таймер інтервалу при розмонтуванні
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isOpen]);

  // Якщо компонент закритий, нічого не рендеримо
  if (!isOpen) return null;

  // Обробник натискання на рядок проекту для завантаження його даних у форму
  const handleEditClick = (proj: ScheduleInfo) => {
    // Встановлюємо вибраний проект для редагування
    setSelectedProject(proj);
    // Заповнюємо форму поточним режимом проекту
    setEditMode(proj.settings?.mode || 'none');
    // Заповнюємо числове значення періоду
    setEditIntervalValue(proj.settings?.intervalValue || 2);
    // Заповнюємо одиниці часу
    setEditIntervalUnit(proj.settings?.intervalUnit || 'hours');
    // Заповнюємо хвилини рандомізації
    setEditRandomOffsetMinutes(proj.settings?.randomOffsetMinutes || 0);
  };

  // Функція для збереження оновлених налаштувань розкладу на сервері
  const handleSaveSettings = async () => {
    // Якщо проект для редагування не вибраний, скасовуємо збереження
    if (!selectedProject) return;
    try {
      // Формуємо об'єкт корисного навантаження з даними форми
      const payload = {
        mode: editMode,
        intervalValue: editIntervalValue,
        intervalUnit: editIntervalUnit,
        randomOffsetMinutes: editRandomOffsetMinutes
      };
      // Надсилаємо PUT запит для оновлення розкладу проекту за його назвою
      const res = await fetch(`/api/schedule/${selectedProject.projectName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // Якщо сервер відповів кодом успіху
      if (res.ok) {
        // Оновлюємо загальну таблицю розкладів проектів
        await fetchSchedule();
        // Формуємо ключ для збереження у локальному сховищі браузера
        const storageKey = `sfl_launch_settings_${selectedProject.projectName}`;
        // Записуємо оновлені параметри у локальне сховище
        localStorage.setItem(storageKey, JSON.stringify(payload));
        // Оновлюємо стейт вибраного проекту новими збереженими значеннями
        setSelectedProject(prev => prev ? { ...prev, mode: editMode, settings: { ...prev.settings, ...payload } } : null);
      }
    } catch (e) {
      // Логуємо помилку у разі виникнення мережевого збою
      console.error('Помилка збереження розкладу:', e);
    }
  };

  // Отримуємо поточний час та обчислюємо початок доби
  const now = new Date();
  // Початок поточної доби в мілісекундах
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Кількість пікселів, що відповідає одній годині на таймлайні
  const pixelsPerHour = 40;
  // Повна ширина сітки таймлайну (24 години * 40px + 160px зсув під стікі-банери назв проектів)
  const timelineWidth = 24 * pixelsPerHour + 160;

  // Функція для генерації вертикальних ліній сітки часу на таймлайні
  const renderTimelineMarks = () => {
    // Ініціалізуємо порожній масив елементів шкали часу
    const marks = [];
    // Будуємо сітку кожні 2 години
    for (let i = 0; i <= 24; i += 2) {
      // Створюємо вертикальну лінію сітки зі зміщенням на 160 пікселів
      marks.push(
        <div 
          // Задаємо унікальний індекс як ключ елемента React
          key={i} 
          // Вертикальна напівпрозора тонка лінія
          className="absolute top-0 bottom-0 border-l border-[var(--interface-border)]/20 flex flex-col items-center pointer-events-none" 
          // Розраховуємо зсув ліворуч із врахуванням колонки назв
          style={{ left: `${i * pixelsPerHour + 160}px` }}
        >
          {/* Текстова мітка часу під шкалою */}
          <span 
            // Оформлення часу: дрібний шрифт, шрифт моно, вторинний колір тексту
            className="text-[9px] text-[var(--interface-text-secondary)] mt-1.5 bg-[var(--interface-bg)] px-1 font-mono font-bold"
          >
            {/* Додаємо провідний нуль для двозначного відображення годин */}
            {i.toString().padStart(2, '0')}:00
          </span>
        </div>
      );
    }
    // Повертаємо сформований масив міток часу
    return marks;
  };

  // Допоміжна функція переведення мілісекунд у координату X на таймлайні
  const getPositionForTime = (timestamp: number) => {
    // Різниця часу від початку доби
    const msSinceStartOfDay = timestamp - startOfDay;
    // Обчислюємо зсув на основі масштабу пікселів за годину
    const offset = msSinceStartOfDay / (1000 * 60 * 60) * pixelsPerHour;
    // Додаємо зсув 160px під ліву стікі-плашку проекту
    return offset + 160;
  };

  // Повертаємо повноцінну JSX верстку нашого компонента
  return (
    // Затемнений напівпрозорий фон, клік на який викликає закриття вікна
    <div 
      // Класи заднього фону, розмиття та анімації плавного відображення
      className="fixed inset-0 z-[var(--z-panel)] bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-200"
      // Клік поза вікном закриває модальне вікно
      onClick={onClose}
    >
      {/* Головний контейнер модального вікна із вертикальним flex-позиціонуванням */}
      <div 
        // Стилізація вікна з використанням тем із CSS-персоналізації
        className="w-full max-w-5xl h-[80vh] flex flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300"
        // Зупиняємо спливання подій кліку, щоб вікно не закривалося при натисканні всередині
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модального вікна */}
        <div 
          // Контейнер з роздільною лінією знизу та гнучким вирівнюванням
          className="flex items-center justify-between p-4 border-b border-[var(--interface-border)]"
        >
          {/* Блок з іконкою та заголовком менеджера */}
          <div className="flex items-center gap-2">
            {/* Декоративний фон для іконки розкладу */}
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <CalendarIcon size={20} />
            </div>
            {/* Опис призначення та назва вікна */}
            <div>
              {/* Первинний заголовок вікна */}
              <h2 className="text-md font-black text-[var(--interface-text-primary)]">Менеджер розкладу</h2>
              {/* Вторинний опис з масштабом годин */}
              <p className="text-[10px] text-[var(--interface-text-secondary)] font-bold uppercase tracking-wider">Таймлайн запусків проектів на добу</p>
            </div>
          </div>
          {/* Кнопка швидкого закриття вікна */}
          <button 
            // Закриваємо вікно при натисканні
            onClick={onClose} 
            // Оформлення хрестика
            className="p-1.5 hover:bg-white/10 text-[var(--interface-text-secondary)] hover:text-[var(--interface-text-primary)] rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Тіло модального вікна: лише таймлайн без дублюючої лівої панелі */}
        <div className="flex flex-1 overflow-hidden">

          {/* Єдина панель: Прокручуваний горизонтальний таймлайн із сіткою */}
          <div 
            // Контейнер прокрутки таймлайну з візерунком точок на тлі
            className="flex-1 overflow-auto relative bg-dot-pattern"
          >
            <div 
              // Внутрішній блок таймлайну з гнучкою шириною під шкалу часу
              className="min-w-max p-4 pt-8 h-full relative" 
              // Задаємо ширину з додаванням 100 пікселів відступу в кінці шкали
              style={{ width: `${timelineWidth + 100}px` }}
            >
              {/* Сітка ліній та індикатор поточного часу */}
              <div 
                // Абсолютно позиціонований контейнер для малювання шкали
                className="absolute top-0 left-4 right-4 h-full pointer-events-none"
              >
                {/* Викликаємо рендеринг вертикальних сіток шкали годин */}
                {renderTimelineMarks()}
                
                {/* Червона лінія "Зараз" для візуального орієнтування */}
                <div 
                  // Вертикальна червона лінія
                  className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 flex flex-col items-center" 
                  // Вираховуємо зсув поточної хвилини на таймлайні
                  style={{ left: `${getPositionForTime(Date.now())}px` }}
                >
                  {/* Бейдж "Зараз" на лінії */}
                  <div className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full mt-6 shadow-md shadow-red-900/40">Зараз</div>
                </div>
              </div>

              {/* Рядки проектів на таймлайні */}
              <div
                // Список рядів запусків з оптимальним вертикальним відступом
                className="mt-1.5 space-y-3 relative z-10"
              >
                {schedules.map((proj) => (
                  <div 
                    // Рядок проекту зі збільшеною висотою h-14 для кращої деталізації
                    key={proj.projectName} 
                    // Стилі рядка проекту: гнучке вирівнювання за центром та тонка межа між рядами
                    className="h-14 relative flex items-center group border-b border-[var(--interface-border)]/10 last:border-b-0"
                  >
                    {/* Стікі-плашка ліворуч з назвою проекту, що завжди видима при горизонтальній прокрутці */}
                    <div 
                      // Використовуємо sticky left-0 та z-30 для фіксації над лініями таймлайну
                      className="sticky left-0 z-30 flex items-center h-full bg-[var(--interface-bg)]/95 pr-3 pl-2 border-r border-[var(--interface-border)]/40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]"
                    >
                      <div 
                        // Контейнер назви проекту з обмеженням та троеточієм
                        className="w-32 truncate text-xs font-black text-[var(--interface-text-primary)] text-left flex flex-col justify-center cursor-pointer hover:text-primary transition-colors"
                        // Клік по стікі-плашці активує налаштування проекту
                        onClick={() => handleEditClick(proj)}
                      >
                        {/* Текст з іменем проекту */}
                        <span>{proj.projectName}</span>
                        {/* Відображення активованого інтервалу */}
                        <span className="text-[8px] text-[var(--interface-text-secondary)] font-black uppercase mt-0.5 tracking-wider">
                          {(proj.mode === 'none' || proj.mode === 'single') ? 'Без розкладу' : 
                           proj.mode === 'interval' ? 'Кожні ' + proj.settings?.intervalValue + (proj.settings?.intervalUnit === 'hours' ? ' год' : ' хв') : 
                           'Інтервал'}
                        </span>
                      </div>
                    </div>

                    {/* Горизонтальна лінія-вісь ряду проекту — тепер розтягується до самого правого краю */}
                    <div 
                      // Встановлюємо абсолютне позиціонування, висоту 1 піксель, напівпрозорий колір рамки та вирівнювання по центру осі Y
                      className="absolute h-[1px] bg-[var(--interface-border)]/20 top-1/2"
                      // Починаємо лінію після лівої фіксованої плашки (160px) і тягнемо до самого правого краю контейнера (right: 0)
                      style={{ left: '160px', right: 0 }}
                    ></div>
                    
                    {/* Синій маркер регулярного запуску — ЗНИЗУ рядка */}
                    {/* Показуємо тільки якщо час у майбутньому (більший за поточний) */}
                    {proj.nextRun && proj.nextRun > Date.now() && (
                      <div 
                        // Контейнер синьої точки — прив'язаний до НИЖНЬОЇ частини рядка (bottom-1)
                        className="absolute flex flex-col items-end z-10 animate-fade-in"
                        // Задаємо точну координату X на осі таймлайну
                        style={{ left: `${getPositionForTime(proj.nextRun)}px`, bottom: '2px' }}
                      >
                        {/* Цифровий бейдж над точкою — відображається ВИЩЕ точки */}
                        <span className="text-[9px] font-black text-blue-400 bg-slate-900 border border-blue-500/40 px-1 py-0.5 rounded backdrop-blur-xs whitespace-nowrap shadow-md shadow-black/80 font-mono mb-0.5">
                          {new Date(proj.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div 
                          // Синя кругла точка з пульсацією — розміщена внизу рядка
                          className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-[var(--interface-bg)] cursor-pointer hover:scale-150 transition-transform shadow-lg shadow-blue-500/50 animate-pulse"
                          // Підказка з детальним часом при наведенні
                          title={`Наступний регулярний запуск: ${new Date(proj.nextRun).toLocaleTimeString()}`}
                        />
                      </div>
                    )}
                    
                    {/* Напівпрозорий блок підсвічування зони рандомізації інтервалу */}
                    {proj.nextRun && proj.nextRun > Date.now() && proj.settings?.randomOffsetMinutes > 0 && (
                      <div 
                        // Панель блідо-синього кольору для позначення зони відхилення — внизу рядка
                        className="absolute h-3 bg-blue-500/20 rounded-full border border-blue-500/10 pointer-events-none"
                        // Розраховуємо ширину та зміщення зони відхилення
                        style={{ 
                          // Початок рандомного проміжку часу
                          left: `${getPositionForTime(proj.nextRun - (proj.settings.randomOffsetMinutes * 60000))}px`,
                          // Ширина зони відповідно до масштабу годин
                          width: `${(proj.settings.randomOffsetMinutes * 2 * 60000) / (1000 * 60 * 60) * pixelsPerHour}px`,
                          // Прив'язуємо зону до низу рядка поряд з синьою точкою
                          bottom: '4px',
                        }}
                        // Опис зони при наведенні
                        title={`Зона випадкового відхилення: ±${proj.settings.randomOffsetMinutes} хв`}
                      ></div>
                    )}
 
                    {/* Жовті маркери програмних запусків від ноди setNextRunNode — ВГОРІ рядка */}
                    {/* Фільтруємо застарілі запуски (тільки майбутній час) */}
                    {proj.plannedRuns.filter(run => run.runAt > Date.now()).map(run => (
                      <div 
                        // Контейнер маркера програмного запуску — прив'язаний до ВЕРХНЬОЇ частини рядка
                        key={run.runAt}
                        // Координата X на основі часу запуску
                        style={{ left: `${getPositionForTime(run.runAt)}px`, top: '2px' }}
                        // Жовтий ромбовидний маркер вгорі рядка
                        className="absolute flex flex-col items-end z-10 animate-fade-in"
                      >
                        <div 
                          // Жовтий ромб з тінню та ефектом наведення
                          className="w-3 h-3 rotate-45 bg-amber-500 ring-2 ring-[var(--interface-bg)] cursor-pointer hover:scale-150 transition-transform shadow-lg shadow-amber-500/50"
                          // Опис програмного запуску
                          title={`Програмний запуск від ноди: ${new Date(run.runAt).toLocaleTimeString()}`}
                        />
                        {/* Цифровий бейдж часу — відображається НИЖЧЕ ромба */}
                        <span className="text-[9px] font-black text-amber-400 bg-slate-900 border border-amber-500/40 px-1 py-0.5 rounded backdrop-blur-xs whitespace-nowrap shadow-md shadow-black/80 font-mono mt-0.5">
                          {new Date(run.runAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Панель налаштувань: тепер це СУСІДНІЙ flex-блок (не абсолютний), що ніколи не перекриває контент! */}
        {selectedProject && (
          // Контейнер налаштувань з тінню зверху та розмиттям тлі
          <div 
            className="bg-[var(--interface-bg)] border-t border-[var(--interface-border)] p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] backdrop-blur-md animate-in slide-in-from-bottom-4 shrink-0"
            // Зупиняємо спливання кліків
            onClick={(e) => e.stopPropagation()}
          >
            {/* Рядок заголовка форми налаштування проекту */}
            <div className="flex justify-between items-center mb-3">
              {/* Відображення імені проекту */}
              <h3 className="text-xs font-black text-[var(--interface-text-primary)] uppercase tracking-wider">Налаштування розкладу: <span className="text-primary font-black lowercase">{selectedProject.projectName}</span></h3>
              {/* Кнопка швидкого закриття панелі параметрів */}
              <button 
                // Закриваємо панель редагування при кліку
                onClick={() => setSelectedProject(null)} 
                // Оформлення хрестика
                className="p-1 hover:bg-white/10 rounded-md text-[var(--interface-text-secondary)] hover:text-[var(--interface-text-primary)] transition-colors"
              >
                <X size={15}/>
              </button>
            </div>
            
            {/* Гнучкий адаптивний рядок параметрів та кнопка збереження */}
            <div className="flex flex-wrap gap-4 items-end justify-between">
              {/* Контейнер полів вводу форми */}
              <div className="flex flex-wrap gap-4 items-end">
                {/* Блок вибору режиму */}
                <div className="space-y-1.5 min-w-[150px]">
                  {/* Текстовий підпис поля режиму */}
                  <label className="text-[9px] font-black text-[var(--interface-text-secondary)] uppercase tracking-wider">Режим</label>
                  {/* Випадаючий список вибору режиму */}
                  <select 
                    // Значення почного режиму розкладу
                    value={editMode} 
                    // Зміна режиму у стані
                    onChange={e => setEditMode(e.target.value)}
                    // Оформлення списку відповідно до тем CSS
                    className="w-full h-8 bg-white/5 border border-[var(--interface-border)] text-[var(--interface-text-primary)] rounded-lg px-2.5 text-xs outline-none focus:border-primary transition-colors"
                  >
                    {/* Варіант без автоматичного запуску */}
                    <option value="none" className="bg-slate-900 text-white">Без розкладу</option>
                    {/* Варіант регулярного запуску за інтервалом */}
                    <option value="interval" className="bg-slate-900 text-white">Кожні N годин/хвилин</option>
                  </select>
                </div>

                {/* Додаткові поля вводу для інтервального режиму розкладу */}
                {editMode === 'interval' && (
                  <>
                    {/* Блок періоду запуску */}
                    <div className="space-y-1.5">
                      {/* Підпис поля */}
                      <label className="text-[9px] font-black text-[var(--interface-text-secondary)] uppercase tracking-wider">Кожні</label>
                      {/* Групування текстового поля та вибору одиниць */}
                      <div className="flex gap-2">
                        {/* Числове поле вводу значення інтервалу */}
                        <Input 
                          // Тип вводу - число
                          type="number" 
                          // Мінімально допустиме значення
                          min={1} 
                          // Значення з нашого стейту
                          value={editIntervalValue} 
                          // Обробник оновлення стейту
                          onChange={e => setEditIntervalValue(Number(e.target.value))}
                          // Стилізація поля вводу
                          className="w-16 h-8 bg-white/5 border-[var(--interface-border)] text-[var(--interface-text-primary)] text-xs rounded-lg"
                        />
                        {/* Вибір одиниць періоду (хвилини/години) */}
                        <select 
                          // Значення одиниці часу
                          value={editIntervalUnit} 
                          // Обробник зміни одиниці
                          onChange={e => setEditIntervalUnit(e.target.value)}
                          // Оформлення випадаючого списку одиниць
                          className="h-8 bg-white/5 border border-[var(--interface-border)] text-[var(--interface-text-primary)] rounded-lg px-2 text-xs outline-none focus:border-primary transition-colors"
                        >
                          {/* Варіант виміру - хвилини */}
                          <option value="minutes" className="bg-slate-900 text-white">хв</option>
                          {/* Варіант виміру - години */}
                          <option value="hours" className="bg-slate-900 text-white">год</option>
                        </select>
                      </div>
                    </div>

                    {/* Блок налаштування хвилин відхилення (рандомізація) */}
                    <div className="space-y-1.5">
                      {/* Підпис поля рандомізації */}
                      <label className="text-[9px] font-black text-[var(--interface-text-secondary)] uppercase tracking-wider">Рандомізація (±)</label>
                      {/* Числовий ввід із позначенням хвилин */}
                      <div className="flex items-center gap-2">
                        {/* Ввід хвилин */}
                        <Input 
                          // Числове поле
                          type="number" 
                          // Мінімально 0 хвилин
                          min={0} 
                          // Значення зі стейту
                          value={editRandomOffsetMinutes} 
                          // Обробник оновлення стейту
                          onChange={e => setEditRandomOffsetMinutes(Number(e.target.value))}
                          // Стилі вводу
                          className="w-16 h-8 bg-white/5 border-[var(--interface-border)] text-[var(--interface-text-primary)] text-xs rounded-lg"
                        />
                        {/* Текстовий індикатор хвилин */}
                        <span className="text-xs text-[var(--interface-text-secondary)] font-bold">хв</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Кнопка збереження конфігурації розкладу */}
              <button 
                // Викликаємо функцію збереження при натисканні
                onClick={handleSaveSettings}
                // Сучасна кнопка з округлими кутами та іконкою дискети
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors self-end shadow-md shadow-primary/20"
              >
                {/* Іконка збереження */}
                <Save size={14} /> 
                {/* Текст кнопки */}
                Зберегти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
