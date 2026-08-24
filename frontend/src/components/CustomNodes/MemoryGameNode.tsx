// Нода «Гра на Пам'ять» — автоматичне проходження міні-гри memory-match
// Використовує комп'ютерний зір для знаходження та збирання пар карток
import { memo } from 'react'; // Імпортуємо memo для оптимізації рендерингу React
import { Handle, Position } from '@xyflow/react'; // Імпортуємо порти та позиції з бібліотеки xyflow
import { Gamepad2, Check, X, Timer, Clock, Flag, SlidersHorizontal } from 'lucide-react'; // Імпортуємо потрібні іконки та SlidersHorizontal для порогу схожості
import BaseNode, { getHandleStyle } from './BaseNode'; // Імпортуємо базовий компонент ноди

const MemoryGameNode = memo(({ id, data }: { id: string; data: any }) => { // Створюємо мемоізований React-компонент
  // Прапорець згортання ноди
  const mini = data.miniCollapsed; // Отримуємо статус згортання з властивостей

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

          {/* Затримка між кліками (час на анімацію перевороту) */}
          <div className="space-y-1.5"> {/* Контейнер для поля затримки перевороту */}
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2"> {/* Стилі підпису */}
              <Timer size={12} /> Затримка перевороту (мс) {/* Текст підпису з іконкою */}
            </label> {/* Кінець підпису */}
            <input // Елемент введення числа
              type="number" // Числовий ввід
              value={data.flipDelay ?? 800} // Поточне значення або 800 за замовчуванням
              onChange={(e) => data.onDataChange(id, { flipDelay: parseInt(e.target.value) || 800 })} // Обробник зміни значення
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилізація поля
              min={200} // Мінімальне значення
              max={3000} // Максимальне значення
              step={100} // Крок зміни
            /> {/* Кінець елементу введення */}
            <p className="text-[9px] text-muted-foreground"> {/* Стилі пояснювального тексту */}
              Час очікування після кліку на картку (анімація перевороту) {/* Пояснення */}
            </p> {/* Кінець параграфу */}
          </div> {/* Кінець контейнера затримки перевороту */}

          {/* Затримка після невдачі (час на анімацію перевертання назад) */}
          <div className="space-y-1.5"> {/* Контейнер для поля затримки помилки */}
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2"> {/* Стилі підпису */}
              <Clock size={12} /> Затримка невдачі (мс) {/* Текст підпису з іконкою */}
            </label> {/* Кінець підпису */}
            <input // Елемент введення числа
              type="number" // Числовий ввід
              value={data.mismatchDelay ?? 1500} // Поточне значення або 1500 за замовчуванням
              onChange={(e) => data.onDataChange(id, { mismatchDelay: parseInt(e.target.value) || 1500 })} // Обробник зміни значення
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилізація поля
              min={500} // Мінімальне значення
              max={5000} // Максимальне значення
              step={100} // Крок зміни
            /> {/* Кінець елементу введення */}
            <p className="text-[9px] text-muted-foreground"> {/* Стилі пояснювального тексту */}
              Час очікування після невдалої пари (картки перевертаються назад) {/* Пояснення */}
            </p> {/* Кінець параграфу */}
          </div> {/* Кінець контейнера затримки невдачі */}

          {/* Налаштування відсотку схожості пар для збігу */}
          <div className="space-y-1.5"> {/* Контейнер для поля схожості пар */}
            <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2"> {/* Стилі підпису */}
              <SlidersHorizontal size={12} /> Схожість пар (0.50 - 1.00) {/* Текст підпису з іконкою */}
            </label> {/* Кінець підпису */}
            <input // Елемент введення числа
              type="number" // Числовий ввід
              value={data.matchThreshold ?? 0.75} // Поточне значення схожості або 0.75 за замовчуванням
              onChange={(e) => data.onDataChange(id, { matchThreshold: parseFloat(e.target.value) || 0.75 })} // Оновлення схожості при зміні
              className="w-full p-2 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилізація
              min={0.50} // Мінімальна схожість
              max={1.00} // Максимальна схожість (повний збіг)
              step={0.01} // Крок зміни
            /> {/* Кінець елементу введення */}
            <p className="text-[9px] text-muted-foreground"> {/* Стилі пояснювального тексту */}
              Мінімальний коефіцієнт схожості для визнання карток парою (за замовчуванням 0.75) {/* Пояснення */}
            </p> {/* Кінець параграфу */}
          </div> {/* Кінець контейнера схожості пар */}

          {/* Налаштування обмеження зони пошуку для комп'ютерного зору */}
          <div className="pt-2 border-t border-border space-y-2"> {/* Контейнер обмеження зони з рамкою зверху */}
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-bold uppercase"> {/* Стилі для лейблу-перемикача */}
              <input // Чекбокс для увімкнення обмеження
                type="checkbox" // Тип чекбокс
                checked={data.useCropZone || false} // Поточний статус з даних
                onChange={(e) => data.onDataChange(id, { useCropZone: e.target.checked })} // Оновлення статусу
                className="rounded bg-muted/50 border-border text-violet-500 focus:ring-violet-500 w-3 h-3" // Стилізація чекбоксу
              /> {/* Кінець чекбоксу */}
              <span>Обмежити зону пошуку</span> {/* Текст перемикача */}
            </label> {/* Кінець підпису перемикача */}

            {/* Відображаємо поля координат лише якщо увімкнено обмеження зони */}
            {data.useCropZone && ( // Умова відображення полів
              <div className="space-y-2 animate-in fade-in duration-150"> {/* Блок налаштувань координат з анімацією */}
                <div className="grid grid-cols-2 gap-2"> {/* Сітка на два стовпці для X та Y */}
                  <div className="space-y-1"> {/* Поле вводу координати X */}
                    <span className="text-[9px] text-muted-foreground">Початок X</span> {/* Підпис */}
                    <input // Поле введення X
                      type="number" // Числовий ввід
                      value={data.cropX ?? 0} // Значення X або 0
                      onChange={(e) => data.onDataChange(id, { cropX: parseInt(e.target.value) || 0 })} // Оновлення X
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилі
                      min={0} // Мінімально нуль
                    /> {/* Кінець введення X */}
                  </div> {/* Кінець контейнера X */}
                  <div className="space-y-1"> {/* Поле вводу координати Y */}
                    <span className="text-[9px] text-muted-foreground">Початок Y</span> {/* Підпис */}
                    <input // Поле введення Y
                      type="number" // Числовий ввід
                      value={data.cropY ?? 0} // Значення Y або 0
                      onChange={(e) => data.onDataChange(id, { cropY: parseInt(e.target.value) || 0 })} // Оновлення Y
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилі
                      min={0} // Мінімально нуль
                    /> {/* Кінець введення Y */}
                  </div> {/* Кінець контейнера Y */}
                </div> {/* Кінець сітки X та Y */}

                <div className="grid grid-cols-2 gap-2"> {/* Сітка на два стовпці для Width та Height */}
                  <div className="space-y-1"> {/* Поле вводу ширини */}
                    <span className="text-[9px] text-muted-foreground">Ширина (W)</span> {/* Підпис */}
                    <input // Поле введення ширини
                      type="number" // Числовий ввід
                      value={data.cropW ?? 800} // Значення W або 800
                      onChange={(e) => data.onDataChange(id, { cropW: parseInt(e.target.value) || 0 })} // Оновлення W
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилі
                      min={100} // Мінімальна ширина 100
                    /> {/* Кінець введення ширини */}
                  </div> {/* Кінець контейнера W */}
                  <div className="space-y-1"> {/* Поле вводу висоти */}
                    <span className="text-[9px] text-muted-foreground">Висота (H)</span> {/* Підпис */}
                    <input // Поле введення висоти
                      type="number" // Числовий ввід
                      value={data.cropH ?? 600} // Значення H або 600
                      onChange={(e) => data.onDataChange(id, { cropH: parseInt(e.target.value) || 0 })} // Оновлення H
                      className="w-full p-1.5 text-xs bg-muted border-none rounded-md focus:ring-1 ring-violet-500 transition-all outline-none font-mono" // Стилі
                      min={100} // Мінімальна висота 100
                    /> {/* Кінець введення висоти */}
                  </div> {/* Кінець контейнера H */}
                </div> {/* Кінець сітки W та H */}
                <p className="text-[8px] text-muted-foreground italic"> {/* Детальний опис для користувача */}
                  Визначає прямокутник на екрані, де розташоване поле з картами {/* Опис призначення координат */}
                </p> {/* Кінець параграфу опису */}
                {/* Закриваємо контейнер координат */}
              </div>
            )}
            {/* Закриваємо контейнер обмеження зони */}
          </div>

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
