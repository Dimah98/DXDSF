// Нода «Гра на Пам'ять» — автоматичне проходження міні-гри memory-match
// Використовує комп'ютерний зір для знаходження та збирання пар карток
import { memo } from 'react'; // Імпортуємо memo для оптимізації рендерингу React
import { Handle, Position } from '@xyflow/react'; // Імпортуємо порти та позиції з бібліотеки xyflow
import { Gamepad2, Check, X, Timer, Clock, Flag, SlidersHorizontal, Zap, Eye } from 'lucide-react'; // Імпортуємо потрібні іконки
import BaseNode, { getHandleStyle } from './BaseNode'; // Імпортуємо базовий компонент ноди

const MemoryGameNode = memo(({ id, data }: { id: string; data: any }) => { // Створюємо мемоізований React-компонент
  // Прапорець згортання ноди
  const mini = data.miniCollapsed; // Отримуємо статус згортання з властивостей
  const engineMode = data.engineMode || 'auto'; // Поточний режим роботи ('auto' | 'phaser' | 'vision')

  return ( // Повертаємо JSX розмітку ноди
    <BaseNode // Головний контейнер ноди BaseNode
      id={id} // Передаємо ідентифікатор ноди
      data={data} // Передаємо дані ноди
      icon={<Gamepad2 size={16} />} // Передаємо іконку ноди Gamepad2
      title={data.label || "Гра Пам'ять"} // Задаємо заголовок ноди
      bgColor="bg-violet-600" // Задаємо фіолетовий колір фону ноди
      type="memoryGameNode" // Задаємо тип ноди
      width="w-64" // Встановлюємо збільшену ширину для розміщення полів введення
    > {/* Початок вмісту BaseNode */}
      {/* Вхідний порт — сигнал запуску гри */}
      <Handle // Створюємо вхідний порт (Handle)
        type="target" // Вказуємо тип як target
        position={Position.Left} // Позиціонуємо ліворуч
        style={getHandleStyle('#7c3aed', '20px', mini)} // Задаємо стиль порту
        className="!left-[-6px]" // Коригуємо зсув ліворуч
      /> {/* Кінець вхідного порту */}
      {/* Вихід: гру пройдено */}
      <Handle // Створюємо перший вихідний порт
        type="source" // Вказуємо тип як source
        position={Position.Right} // Позиціонуємо праворуч
        id="success" // Ідентифікатор успішного виходу
        style={getHandleStyle('#22c55e', mini ? '50%' : '35%', mini)} // Зелений колір
        className="!right-[-6px]" // Коригуємо зсув праворуч
      /> {/* Кінець порту успіху */}
      {/* Вихід: помилка або час вийшов */}
      <Handle // Створюємо XML порт для помилок
        type="source" // Вказуємо тип як source
        position={Position.Right} // Позиціонуємо праворуч
        id="error" // Ідентифікатор виходу з помилкою
        style={getHandleStyle('#ef4444', mini ? '50%' : '65%', mini)} // Червоний колір
        className="!right-[-6px]" // Коригуємо зсув праворуч
      /> {/* Кінець порту помилки */}

      {/* Розгорнутий вміст ноди, якщо вона не згорнута */}
      {!mini && ( // Перевірка чи не згорнуто
        <div className="p-3 space-y-3"> {/* Контейнер вмісту з відступами */}

          {/* Режим рушія (Engine Mode) */}
          <div className="bg-card/60 p-2 rounded border border-violet-500/30">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-violet-400 font-semibold text-[11px]">
                <Zap size={13} />
                Режим:
              </span>
              <select
                value={engineMode}
                onChange={(e) => data.onDataChange(id, { engineMode: e.target.value })}
                className="bg-background/80 border border-border px-1.5 py-0.5 rounded text-[10px] font-medium focus:ring-1 focus:ring-violet-500 outline-none cursor-pointer"
              >
                <option value="auto">⚡ Авто (Phaser + Зір)</option>
                <option value="phaser">🎮 Phaser Hook (Швидкий)</option>
                <option value="vision">👁️ Комп'ютерний зір</option>
              </select>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {engineMode === 'phaser'
                ? "Зчитує картки з пам'яті Phaser та відкриває по черзі як людина"
                : engineMode === 'vision'
                ? "Аналіз скріншотів через комп'ютерний зір"
                : "Phaser Hook за наявності з авто-перемиканням на зір"}
            </p>
          </div>

          {/* Налаштування Phaser Hook */}
          {engineMode !== 'vision' && (
            <div className="space-y-2 p-2 rounded bg-violet-950/20 border border-violet-500/20">
              <div className="text-[10px] font-bold uppercase text-violet-300 flex items-center gap-1.5">
                <Zap size={11} /> Затримки Phaser Hook
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground">Клік пари (мс)</span>
                  <input
                    type="number"
                    value={data.phaserFlipDelay ?? 400}
                    onChange={(e) => data.onDataChange(id, { phaserFlipDelay: parseInt(e.target.value) || 400 })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                    min={100}
                    max={1500}
                    step={50}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground">Збір пари (мс)</span>
                  <input
                    type="number"
                    value={data.phaserPairDelay ?? 500}
                    onChange={(e) => data.onDataChange(id, { phaserPairDelay: parseInt(e.target.value) || 500 })}
                    className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                    min={150}
                    max={2000}
                    step={50}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Секція комп'ютерного зору (Pixel Vision) */}
          {engineMode !== 'phaser' && (
            <div className="space-y-3 pt-1">
              {engineMode === 'auto' && (
                <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Eye size={11} /> Параметри комп'ютерного зору (резерв)
                </div>
              )}

              {/* Затримка між кліками (час на анімацію перевороту) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Timer size={12} /> Затримка перевороту (мс)
                </label>
                <input
                  type="number"
                  value={data.flipDelay ?? 800}
                  onChange={(e) => data.onDataChange(id, { flipDelay: parseInt(e.target.value) || 800 })}
                  className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                  min={200}
                  max={3000}
                  step={100}
                />
                <p className="text-[9px] text-muted-foreground">
                  Час очікування після кліку на картку (анімація перевороту)
                </p>
              </div>

              {/* Затримка після невдачі (час на анімацію перевертання назад) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Clock size={12} /> Затримка невдачі (мс)
                </label>
                <input
                  type="number"
                  value={data.mismatchDelay ?? 1500}
                  onChange={(e) => data.onDataChange(id, { mismatchDelay: parseInt(e.target.value) || 1500 })}
                  className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                  min={500}
                  max={5000}
                  step={100}
                />
                <p className="text-[9px] text-muted-foreground">
                  Час очікування після невдалої пари (картки перевертаються назад)
                </p>
              </div>

              {/* Налаштування відсотку схожості пар для збігу */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <SlidersHorizontal size={12} /> Схожість пар (0.50 - 1.00)
                </label>
                <input
                  type="number"
                  value={data.matchThreshold ?? 0.75}
                  onChange={(e) => data.onDataChange(id, { matchThreshold: parseFloat(e.target.value) || 0.75 })}
                  className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                  min={0.50}
                  max={1.00}
                  step={0.01}
                />
                <p className="text-[9px] text-muted-foreground">
                  Мінімальний коефіцієнт схожості для визнання карток парою
                </p>
              </div>

              {/* Налаштування обмеження зони пошуку для комп'ютерного зору */}
              <div className="pt-2 border-t border-border space-y-2">
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-bold uppercase">
                  <input
                    type="checkbox"
                    checked={data.useCropZone || false}
                    onChange={(e) => data.onDataChange(id, { useCropZone: e.target.checked })}
                    className="rounded bg-muted/50 border-border text-violet-500 focus:ring-violet-500 w-3 h-3"
                  />
                  <span>Обмежити зону пошуку</span>
                </label>

                {data.useCropZone && (
                  <div className="space-y-2 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Початок X</span>
                        <input
                          type="number"
                          value={data.cropX ?? 0}
                          onChange={(e) => data.onDataChange(id, { cropX: parseInt(e.target.value) || 0 })}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Початок Y</span>
                        <input
                          type="number"
                          value={data.cropY ?? 0}
                          onChange={(e) => data.onDataChange(id, { cropY: parseInt(e.target.value) || 0 })}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                          min={0}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Ширина (W)</span>
                        <input
                          type="number"
                          value={data.cropW ?? 800}
                          onChange={(e) => data.onDataChange(id, { cropW: parseInt(e.target.value) || 0 })}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                          min={100}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">Висота (H)</span>
                        <input
                          type="number"
                          value={data.cropH ?? 600}
                          onChange={(e) => data.onDataChange(id, { cropH: parseInt(e.target.value) || 0 })}
                          className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono"
                          min={100}
                        />
                      </div>
                    </div>
                    <p className="text-[8px] text-muted-foreground italic">
                      Визначає прямокутник на екрані, де розташоване поле з картами
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Налаштування кнопок завершення — нода зупиняється при появі цих текстів */}
          <div className="pt-2 border-t border-border space-y-1.5"> {/* Секція кнопок завершення */}
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2"> {/* Підпис */}
              <Flag size={12} /> Кнопки завершення {/* Назва налаштування */}
            </label> {/* Кінець підпису */}
            {/* Текстове поле для введення варіантів текстів кнопок завершення */}
            <textarea
              value={data.exitButtonTexts ?? ''}
              onChange={(e) => data.onDataChange(id, { exitButtonTexts: e.target.value })}
              placeholder={"Сбір нагороди\nStart\nbutton:has-text(\"Далі\")"}
              rows={3}
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none resize-none font-mono"
            />
            <p className="text-[9px] text-muted-foreground">
              Кожен варіант — новий рядок. Можна текст або CSS-селектор Playwright.
            </p> {/* Кінець параграфу */}
          </div> {/* Кінець секції кнопок */}

          {/* Підписи портів виходу */}
          <div className="flex justify-between items-center px-1 pt-1 border-t border-border"> {/* Контейнер підписів */}
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase"> {/* Зелений успіх */}
              <Check size={10} /> Пройдено {/* Текст успішного проходження */}
            </div> {/* Кінець блоку успіху */}
            <div className="flex items-center gap-1 text-[9px] font-bold text-red-500 uppercase"> {/* Червона помилка */}
              Помилка <X size={10} /> {/* Текст помилки */}
            </div> {/* Кінець блоку помилки */}
          </div> {/* Кінець підписів портів */}
          {/* Закриваємо розгорнутий контейнер ноди */}
        </div>
      )}
      {/* Закриваємо BaseNode */}
    </BaseNode>
  ); // Кінець повернення JSX
}); // Кінець мемоізації компонента

export default MemoryGameNode; // Експортуємо ноду за замовчуванням
