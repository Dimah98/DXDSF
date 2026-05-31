import React, { useState, useEffect } from 'react';
import { X, Settings2, Clock, Calendar as CalendarIcon, Save } from 'lucide-react';
import { Input } from './ui/input';

interface ScheduledRun {
  projectName: string;
  runAt: number;
  source: string;
  randomOffset?: number;
}

interface ScheduleInfo {
  projectName: string;
  mode: string;
  nextRun: number | null;
  lastRun: number;
  settings: any;
  plannedRuns: ScheduledRun[];
}

export default function ScheduleManager({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ScheduleInfo | null>(null);

  // Форма редагування
  const [editMode, setEditMode] = useState<string>('none');
  const [editIntervalValue, setEditIntervalValue] = useState<number>(2);
  const [editIntervalUnit, setEditIntervalUnit] = useState<string>('hours');
  const [editRandomOffsetMinutes, setEditRandomOffsetMinutes] = useState<number>(0);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchedule();
      const interval = setInterval(fetchSchedule, 30000); // автооновлення
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEditClick = (proj: ScheduleInfo) => {
    setSelectedProject(proj);
    setEditMode(proj.settings?.mode || 'none');
    setEditIntervalValue(proj.settings?.intervalValue || 2);
    setEditIntervalUnit(proj.settings?.intervalUnit || 'hours');
    setEditRandomOffsetMinutes(proj.settings?.randomOffsetMinutes || 0);
  };

  const handleSaveSettings = async () => {
    // Перевіряємо чи вибраний проект для збереження
    if (!selectedProject) return;
    try {
      // Формуємо тіло запиту з поточними налаштуваннями форми
      const payload = {
        mode: editMode,
        intervalValue: editIntervalValue,
        intervalUnit: editIntervalUnit,
        randomOffsetMinutes: editRandomOffsetMinutes
      };
      // Відправляємо PUT запит на бекенд для збереження розкладу проекту
      const res = await fetch(`/api/schedule/${selectedProject.projectName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // Оновлюємо список розкладів без закриття панелі налаштувань
        await fetchSchedule();
        // Формуємо ключ для збереження налаштувань запуску в localStorage
        const storageKey = `sfl_launch_settings_${selectedProject.projectName}`;
        // Записуємо оновлені налаштування запуску в localStorage
        localStorage.setItem(storageKey, JSON.stringify(payload));
        // Оновлюємо selectedProject із новими даними (щоб панель показувала актуальний стан)
        setSelectedProject(prev => prev ? { ...prev, mode: editMode, settings: { ...prev.settings, ...payload } } : null);
      }
    } catch (e) {
      console.error('Помилка збереження розкладу:', e);
    }
  };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const pixelsPerHour = 40; // Ширина години в пікселях
  const timelineWidth = 24 * pixelsPerHour;

  // Функція для візуалізації шкали часу з інтервалом у дві години
  const renderTimelineMarks = () => {
    // Ініціалізуємо порожній масив для міток часу на таймлайні
    const marks = [];
    // Перебираємо години від 0 до 24 з кроком у дві години для побудови сітки
    for (let i = 0; i <= 24; i += 2) {
      // Додаємо елемент розмітки години з горизонтальним позиціонуванням на таймлайні
      marks.push(
        <div 
          // Унікальний ключ для React рендерингу
          key={i} 
          // Стилізація лінії шкали часу (абсолютне позиціонування та межа)
          className="absolute top-0 bottom-0 border-l border-[var(--interface-border)]/30 flex flex-col items-center" 
          // Розрахунок зсуву вліво в пікселях на основі кроку години
          style={{ left: `${i * pixelsPerHour}px` }}
        >
          <span 
            // Класи оформлення тексту години (розмір шрифту, колір тексту, фон та внутрішній відступ)
            className="text-[9px] text-[var(--interface-text-secondary)] mt-1 bg-[var(--interface-bg)] px-1"
          >
            {/* Рендеримо текст поточної години у форматі HH:00 */}
            {i.toString().padStart(2, '0')}:00
          </span>
        </div>
      );
    }
    // Повертаємо сформований масив ліній сітки та текстових підписів
    return marks;
  };

  const getPositionForTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const msSinceStartOfDay = timestamp - startOfDay;
    // Показуємо тільки якщо в межах поточних 24 годин (плюс-мінус)
    // Але для простоти намалюємо все, що сьогодні і завтра
    const offset = msSinceStartOfDay / (1000 * 60 * 60) * pixelsPerHour;
    return offset;
  };

  // Повертаємо JSX розмітку компонента
  return (
    // Затінення фону на весь екран з можливістю закриття модалки при кліку
    <div 
      // Класи для затемнення заднього фону, розмиття та анімації появи
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      // Клік на область за межами вікна закриває менеджер розкладу
      onClick={onClose}
    >
      {/* Головний контейнер модального вікна з підтримкою глобальної теми */}
      <div 
        // Стилізація з використанням змінних персоналізації (--interface-bg, --interface-border) та анімації
        className="w-full max-w-5xl h-[80vh] flex flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300"
        // Зупиняємо спливання кліку, щоб кліки всередині вікна не закривали його
        onClick={(e) => e.stopPropagation()}
      >
        {/* Хедер модального вікна */}
        <div 
          // Контейнер заголовка з межею роздільника
          className="flex items-center justify-between p-4 border-b border-[var(--interface-border)]"
        >
          {/* Ліва частина хедера з іконкою та заголовком */}
          <div className="flex items-center gap-2">
            {/* Контейнер іконки календаря з акцентним фоном */}
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <CalendarIcon size={20} />
            </div>
            {/* Блок текстового опису вікна */}
            <div>
              {/* Заголовок менеджера розкладу з первинним кольором тексту з персоналізації */}
              <h2 className="text-lg font-bold text-[var(--interface-text-primary)]">Менеджер розкладу</h2>
              {/* Опис з вторинним кольором тексту з персоналізації */}
              <p className="text-xs text-[var(--interface-text-secondary)]">Таймлайн запусків проектів на добу</p>
            </div>
          </div>
          {/* Кнопка закриття вікна (хрестик) */}
          <button 
            // Обробник кліку для закриття вікна
            onClick={onClose} 
            // Стилі кнопки хрестика з ефектом наведення
            className="p-2 hover:bg-white/10 text-[var(--interface-text-secondary)] hover:text-[var(--interface-text-primary)] rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Тіло модального вікна */}
        <div className="flex flex-1 overflow-hidden">
          {/* Ліва панель - Список проектів */}
          <div 
            // Контейнер списку проектів з напівпрозорим фоном
            className="w-64 border-r border-[var(--interface-border)] overflow-y-auto bg-white/5"
          >
            {schedules.map(proj => (
              <div 
                // Елемент проекту в списку з обробником вибору
                key={proj.projectName}
                // Стилізація проекту залежно від того, чи вибраний він користувачем
                className={`p-3 border-b border-[var(--interface-border)]/50 flex justify-between items-center group cursor-pointer transition-colors ${selectedProject?.projectName === proj.projectName ? 'bg-primary/10 text-[var(--interface-text-primary)]' : 'hover:bg-white/5 text-[var(--interface-text-secondary)] hover:text-[var(--interface-text-primary)]'}`}
                // Виклик обробника при кліку на проект
                onClick={() => handleEditClick(proj)}
              >
                {/* Блок з назвою та типом розкладу проекту */}
                <div>
                  {/* Назва проекту */}
                  <div className="font-bold text-sm">{proj.projectName}</div>
                  {/* Відображення поточного режиму розкладу проекту */}
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {(proj.mode === 'none' || proj.mode === 'single') ? 'Без розкладу' : 
                     proj.mode === 'interval' ? (proj.settings?.randomOffsetMinutes > 0 ? 'Інтервал + Рандом' : 'Інтервал') : 
                     'Невідомий режим'}
                  </div>
                </div>
                {/* Кнопка налаштувань проекту (показується при наведенні) */}
                <button className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-primary transition-all">
                  <Settings2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Права панель - Таймлайн */}
          <div 
            // Контейнер таймлайну з горизонтальною прокруткою та візерунком точок
            className="flex-1 overflow-auto relative bg-dot-pattern"
          >
            <div 
              // Внутрішній блок таймлайну з фіксованою розрахованою шириною
              className="min-w-max p-4 pt-8 h-full relative" 
              style={{ width: `${timelineWidth + 100}px` }}
            >
              {/* Шкала часу */}
              <div 
                // Контейнер розмітки часу з абсолютним позиціонуванням
                className="absolute top-0 left-4 right-4 h-full pointer-events-none"
              >
                {renderTimelineMarks()}
                
                {/* Лінія "Зараз" */}
                <div 
                  // Стилі для червоної лінії з абсолютним зсувом
                  className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 flex flex-col items-center" 
                  // Встановлюємо зсув лінії за поточним часом
                  style={{ left: `${getPositionForTime(Date.now())}px` }}
                >
                  {/* Кругла текстова наліпка "Зараз" на лінії */}
                  <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-5">Зараз</div>
                </div>
              </div>

              {/* Рядки проектів */}
              <div 
                // Контейнер з рядами запусків для кожного проекту
                className="mt-6 space-y-8 relative z-10"
              >
                {schedules.map((proj, idx) => (
                  <div 
                    // Рядок проекту з відносною висотою
                    key={proj.projectName} 
                    className="h-8 relative flex items-center group"
                  >
                    {/* Фонова горизонтальна лінія для ряду проекту */}
                    <div className="absolute left-0 right-0 h-[1px] bg-[var(--interface-border)]/30 top-1/2"></div>
                    
                    {/* Регулярний наступний запуск */}
                    {proj.nextRun && (
                      <div 
                        // Синя кругла мітка наступного запуску
                        className="absolute w-3 h-3 rounded-full bg-primary ring-4 ring-[var(--interface-bg)] top-1/2 -translate-y-1/2 cursor-pointer hover:scale-150 transition-transform z-10"
                        // Розрахунок позиції по осі X
                        style={{ left: `${getPositionForTime(proj.nextRun)}px` }}
                        // Спливаюча підказка з точним часом
                        title={`Наступний запуск: ${new Date(proj.nextRun).toLocaleTimeString()}`}
                      ></div>
                    )}
                    
                    {/* Зона рандомізації */}
                    {proj.nextRun && proj.settings?.randomOffsetMinutes > 0 && (
                      <div 
                        // Класи напівпрозорого підсвічування зони рандомізації
                        className="absolute h-4 bg-primary/25 rounded-full top-1/2 -translate-y-1/2"
                        // Задаємо ліву межу та ширину зони рандомізації
                        style={{ 
                          // Ліва межа зони
                          left: `${getPositionForTime(proj.nextRun - (proj.settings.randomOffsetMinutes * 60000))}px`,
                          // Ширина зони у пікселях відповідно до масштабу таймлайну
                          width: `${(proj.settings.randomOffsetMinutes * 2 * 60000) / (1000 * 60 * 60) * pixelsPerHour}px`
                        }}
                        // Підказка про інтервал рандомізації
                        title={`Зона рандомізації: ±${proj.settings.randomOffsetMinutes} хв`}
                      ></div>
                    )}

                    {/* Програмні запуски (від ноди) */}
                    {proj.plannedRuns.map(run => (
                      <div 
                        // Помаранчевий ромб для позначення програмного запуску
                        key={run.runAt}
                        // Оформлення мітки у вигляді ромба з обвідкою фону
                        className="absolute w-3 h-3 rotate-45 bg-amber-500 ring-4 ring-[var(--interface-bg)] top-1/2 -translate-y-1/2 cursor-pointer hover:scale-150 transition-transform z-10"
                        // Зсув відповідно до запланованого часу
                        style={{ left: `${getPositionForTime(run.runAt)}px` }}
                        // Точний час у спливаючій підказці
                        title={`Програмний запуск: ${new Date(run.runAt).toLocaleTimeString()}`}
                      ></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Панель налаштувань (спливає знизу при виборі проекту) */}
        {selectedProject && (
          // Контейнер панелі налаштувань з тінню та анімацією виїзду знизу
          // Зупиняємо спливання кліку щоб закриття backdrop не спрацювало при кліку на панелі
          <div 
            className="absolute bottom-0 left-0 right-0 bg-[var(--interface-bg)] border-t border-[var(--interface-border)] p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] backdrop-blur-md animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок панелі редагування розкладу */}
            <div className="flex justify-between items-center mb-4">
              {/* Текст з назвою вибраного проекту */}
              <h3 className="font-bold text-[var(--interface-text-primary)]">Розклад для: <span className="text-primary">{selectedProject.projectName}</span></h3>
              {/* Кнопка скасування вибору (хрестик) */}
              <button 
                // Очищення вибору при кліку
                onClick={() => setSelectedProject(null)} 
                // Оформлення кнопки хрестика
                className="p-1 hover:bg-white/10 rounded-md text-[var(--interface-text-secondary)] hover:text-[var(--interface-text-primary)]"
              >
                <X size={16}/>
              </button>
            </div>
            
            {/* Сітка параметрів налаштування розкладу */}
            <div className="grid grid-cols-4 gap-6 items-end">
              {/* Вибір режиму розкладу */}
              <div className="space-y-2">
                {/* Мітка поля вибору режиму */}
                <label className="text-xs font-bold text-[var(--interface-text-secondary)] uppercase">Режим</label>
                {/* Випадаючий список вибору режиму розкладу */}
                <select 
                  // Значення вибраного режиму
                  value={editMode} 
                  // Обробник зміни режиму
                  onChange={e => setEditMode(e.target.value)}
                  // Класи оформлення списку з кольорами персоналізації
                  className="w-full h-9 bg-white/5 border border-[var(--interface-border)] text-[var(--interface-text-primary)] rounded-md px-3 text-sm outline-none focus:border-primary transition-colors"
                >
                  {/* Варіант "Без розкладу" */}
                  <option value="none" className="bg-slate-900 text-white">Без розкладу</option>
                  {/* Варіант "Кожні N годин/хвилин" */}
                  <option value="interval" className="bg-slate-900 text-white">Кожні N годин/хвилин</option>
                </select>
              </div>

              {/* Додаткові поля для інтервального режиму розкладу */}
              {editMode === 'interval' && (
                <>
                  {/* Блок налаштування числового значення інтервалу */}
                  <div className="space-y-2">
                    {/* Мітка інтервалу */}
                    <label className="text-xs font-bold text-[var(--interface-text-secondary)] uppercase">Інтервал</label>
                    {/* Контейнер для поля вводу та випадаючого списку одиниць */}
                    <div className="flex gap-2">
                      {/* Ввід числового значення */}
                      <Input 
                        // Числовий тип вводу
                        type="number" 
                        // Мінімальне значення 1
                        min={1} 
                        // Значення інтервалу
                        value={editIntervalValue} 
                        // Зміна значення при вводі
                        onChange={e => setEditIntervalValue(Number(e.target.value))}
                        // Класи оформлення вводу з кольорами теми
                        className="w-20 bg-white/5 border-[var(--interface-border)] text-[var(--interface-text-primary)]"
                      />
                      {/* Список вибору одиниць часу */}
                      <select 
                        // Поточна одиниця часу
                        value={editIntervalUnit} 
                        // Зміна одиниці часу
                        onChange={e => setEditIntervalUnit(e.target.value)}
                        // Стилі випадаючого списку одиниць часу
                        className="flex-1 bg-white/5 border border-[var(--interface-border)] text-[var(--interface-text-primary)] rounded-md px-3 outline-none focus:border-primary transition-colors"
                      >
                        {/* Одиниця виміру - хвилини */}
                        <option value="minutes" className="bg-slate-900 text-white">Хвилин</option>
                        {/* Одиниця виміру - години */}
                        <option value="hours" className="bg-slate-900 text-white">Годин</option>
                      </select>
                    </div>
                  </div>

                  {/* Блок налаштування випадкового відхилення (рандомізації) запусків */}
                  <div className="space-y-2">
                    {/* Мітка рандомізації */}
                    <label className="text-xs font-bold text-[var(--interface-text-secondary)] uppercase flex items-center gap-1">
                      Рандомізація (±)
                    </label>
                    {/* Поле вводу хвилин відхилення */}
                    <div className="flex items-center gap-2">
                      {/* Числовий ввід хвилин */}
                      <Input 
                        // Тип вводу числа
                        type="number" 
                        // Мінімальне значення 0
                        min={0} 
                        // Поточні хвилини рандомізації
                        value={editRandomOffsetMinutes} 
                        // Обробник зміни значення
                        onChange={e => setEditRandomOffsetMinutes(Number(e.target.value))}
                        // Класи оформлення поля вводу з кольорами теми
                        className="w-20 bg-white/5 border-[var(--interface-border)] text-[var(--interface-text-primary)]"
                      />
                      {/* Текст позначення хвилин */}
                      <span className="text-sm text-[var(--interface-text-secondary)]">хвилин</span>
                    </div>
                  </div>
                </>
              )}

              {/* Кнопка збереження внесених налаштувань */}
              <div className="col-start-4 flex justify-end">
                {/* Кнопка відправки форми налаштувань */}
                <button 
                  // Обробник збереження налаштувань
                  onClick={handleSaveSettings}
                  // Класи оформлення кнопки збереження з акцентним кольором
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors"
                >
                  <Save size={16} /> Зберегти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
