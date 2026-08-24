import React, { useState, useEffect, useCallback } from 'react'; // Імпортуємо React та хуки стейту, ефектів та мемоізації
import { X } from 'lucide-react'; // Іконка закриття модалки

interface InventoryModalProps { // Пропси компонента
  isOpen: boolean; // Чи відкрита модалка
  onClose: () => void; // Колбек закриття
  projectName: string; // Назва поточного проекту
} // Кінець інтерфейсу пропсів

interface ScanResult { // Структура одного предмета інвентарю
  image: string; // URL зображення предмета
  number: number; // Кількість предмета
} // Кінець інтерфейсу предмета

interface InventoryResponse { // Структура відповіді API інвентарю
  data: ScanResult[]; // Список предметів
  timestamp: number | null; // Час оновлення
  projectName: string; // Назва проекту
} // Кінець інтерфейсу відповіді

interface CategoriesResponse { // Структура відповіді API категорій
  categories: string[]; // Список категорій
  itemToCategories: Record<string, string[]>; // Зв'язок назви предмета зі списком категорій
} // Кінець інтерфейсу категорій

export const InventoryModal: React.FC<InventoryModalProps> = ({ isOpen, onClose, projectName }) => {
  const [data, setData] = useState<ScanResult[]>([]); // Стейт для предметів інвентарю
  const [loading, setLoading] = useState(false); // Стейт індикатора завантаження
  const [error, setError] = useState<string | null>(null); // Стейт помилок
  const [timestamp, setTimestamp] = useState<number | null>(null); // Стейт часу оновлення
  const [categories, setCategories] = useState<string[]>([]); // Стейт для списку категорій
  const [itemToCategories, setItemToCategories] = useState<Record<string, string[]>>({}); // Стейт для зв'язку предметів з категоріями
  const [selectedCategory, setSelectedCategory] = useState<string>('Всі'); // Стейт поточної вибраної категорії
  const [dataSource, setDataSource] = useState<'inventory' | 'stock'>('inventory'); // Стейт джерела (inventory або stock)

  const fetchInventory = useCallback(async () => { // Завантаження даних інвентарю з API
    if (!projectName) return; // Якщо назви проекту немає — виходимо
    setLoading(true); // Включаємо індикатор завантаження
    setError(null); // Очищуємо попередні помилки
    try { // Спроба виконати запит
      const response = await fetch(`/api/inventory/${encodeURIComponent(projectName)}?source=${dataSource}`); // Відправляємо GET запит
      if (!response.ok) { // Якщо відповідь не успішна
        if (response.status === 401) throw new Error('Необхідна аутентифікація'); // Не авторизовано
        else if (response.status === 429) throw new Error('Занадто багато запитів. Спробуйте пізніше.'); // Перевищено ліміт
        else if (response.status === 400) throw new Error("Неправильне ім'я проекту"); // Некоректна назва
        else throw new Error('Не вдалося завантажити дані'); // Загальна помилка
      } // Кінець перевірки статусу
      const result: InventoryResponse = await response.json(); // Парсимо відповідь
      setData(result.data || []); // Записуємо предмети у стейт
      setTimestamp(result.timestamp); // Записуємо таймстемп
    } catch (err) { // Обробка помилок
      console.error('Failed to load inventory:', err); // Виводимо помилку в консоль
      setError(err instanceof Error ? err.message : "Помилка мережі. Перевірте з'єднання."); // Встановлюємо текст помилки
    } finally { // Завершення запиту
      setLoading(false); // Вимикаємо індикатор завантаження
    } // Кінець try-catch-finally
  }, [projectName, dataSource]); // Залежність від назви проекту та джерела

  const fetchCategories = useCallback(async () => { // Завантаження категорій з API
    try { // Спроба виконати запит
      const response = await fetch('/api/inventory/categories'); // GET запит до API категорій
      if (response.ok) { // Якщо відповідь успішна
        const result: CategoriesResponse = await response.json(); // Парсимо дані
        setCategories(result.categories || []); // Записуємо категорії
        setItemToCategories(result.itemToCategories || {}); // Записуємо зв'язки
      } // Кінець перевірки
    } catch (err) { // Обробка помилок
      console.error('Failed to load categories:', err); // Виводимо помилку в консоль
    } // Кінець try-catch
  }, []); // Без залежностей

  useEffect(() => { // Ефект при відкритті модалки або зміні джерела
    if (isOpen) { // Лише якщо модалка відкрита
      fetchInventory(); // Завантажуємо предмети
      fetchCategories(); // Завантажуємо категорії
    } // Кінець умови
  }, [isOpen, fetchInventory, fetchCategories]); // Залежності ефекту

  useEffect(() => { // Ефект для обробки клавіші Escape
    const handleEscape = (e: KeyboardEvent) => { // Обробник натискання клавіші
      if (e.key === 'Escape' && isOpen) onClose(); // Закриваємо при натисканні Escape
    }; // Кінець обробника
    if (isOpen) { // Якщо модалка відкрита
      document.addEventListener('keydown', handleEscape); // Підписуємось на подію
      document.body.style.overflow = 'hidden'; // Вимикаємо прокрутку сторінки
    } // Кінець умови
    return () => { // Функція очищення ефекту
      document.removeEventListener('keydown', handleEscape); // Відписуємось від події
      document.body.style.overflow = 'unset'; // Повертаємо прокрутку
    }; // Кінець функції очищення
  }, [isOpen, onClose]); // Залежності ефекту

  // Витягує читабельне ім'я предмета з URL зображення
  // Приклади: "/api/im/Sunflower.png" → "Sunflower"
  //           "/api/images/rhubarb_seed.png" → "Rhubarb Seed"
  const extractItemName = (imageUrl: string): string => { // Функція отримання імені предмета з URL
    const filename = imageUrl.split('/').pop() || ''; // Беремо частину після останнього слеша
    const nameWithoutExt = filename.replace(/\.[^.]+$/, ''); // Видаляємо розширення файлу
    return nameWithoutExt.replace(/_/g, ' '); // Замінюємо підкреслення на пробіли
  }; // Кінець extractItemName

  // Витягує унікальний ключ предмета (ім'я файлу без розширення)
  // Приклад: "/api/im/stone%20Rock.png" → "stone Rock"
  const extractItemKey = (imageUrl: string): string => {
    const filename = imageUrl.split('/').pop() || '';
    return decodeURIComponent(filename.replace(/\.[^.]+$/, ''));
  };

  const getItemCategories = (imageUrl: string): string[] => {
    const itemKey = extractItemKey(imageUrl);
    if (itemToCategories[itemKey] && itemToCategories[itemKey].length > 0) {
      return itemToCategories[itemKey];
    }

    const cleanKey = itemKey.toLowerCase().trim();
    for (const [key, cats] of Object.entries(itemToCategories)) {
      const cleanTarget = key.toLowerCase().trim();
      if (
        cleanTarget === cleanKey ||
        cleanTarget.replace(/ /g, '_') === cleanKey ||
        cleanTarget.replace(/_/g, ' ') === cleanKey
      ) {
        return cats;
      }
    }
    return [];
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23374151"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239CA3AF" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
  };

  const filteredData = data.filter((item) => {
    if (selectedCategory === 'Всі') return true;
    const itemCats = getItemCategories(item.image);
    if (selectedCategory === 'без категорії') {
      return itemCats.length === 0 || itemCats.includes('без категорії');
    }
    return itemCats.includes(selectedCategory);
  });

  if (!isOpen) return null; // Не рендеримо якщо модалка закрита

  return (
    // Оверлей з розмитим фоном
    <div
      className="fixed inset-0 z-[var(--z-modal-high)] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
    >
      {/* Контейнер модалки */}
      <div
        className="flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl border bg-[var(--interface-bg)] border-[var(--interface-border)] backdrop-blur-md overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div>
            <h2
              id="inventory-modal-title"
              className="text-[14px] font-black uppercase text-[var(--accent-indigo)] tracking-widest"
            >
              {dataSource === 'inventory' ? 'Інвентар' : 'Склад (Stock)'}
            </h2>
            <p className="text-[12px] font-bold text-[var(--interface-text-primary)] mt-0.5">{projectName}</p>
            {timestamp && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Оновлено: {new Date(timestamp).toLocaleString('uk-UA')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Перемикач джерела: Інвентар / Склад */}
            <div className="flex items-center p-1 bg-black/40 border border-white/10 rounded-xl">
              <button
                onClick={() => setDataSource('inventory')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  dataSource === 'inventory'
                    ? 'bg-[var(--accent-indigo)] text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📦 Інвентар
              </button>
              <button
                onClick={() => setDataSource('stock')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  dataSource === 'stock'
                    ? 'bg-[var(--accent-indigo)] text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏬 Склад
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-muted/30 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
              title="Закрити"
              aria-label="Закрити модальне вікно"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Панель категорій — показуємо тільки якщо є хоча б одна категорія */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 overflow-x-auto shrink-0 scrollbar-thin">
            {/* Кнопка "Всі" — завжди перша */}
            <button
              onClick={() => setSelectedCategory('Всі')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'Всі'
                  ? 'bg-[var(--accent-indigo)] text-white shadow-lg'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
              }`}
            >
              Всі
            </button>
            {/* Кнопки для кожної категорії */}
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[var(--accent-indigo)] text-white shadow-lg'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Область контенту */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Стан завантаження */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-4 border-[var(--accent-indigo)]/30 border-t-[var(--accent-indigo)] rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Завантаження інвентаря...</p>
            </div>
          )}

          {/* Стан помилки */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-red-400 text-center">
                <p className="text-lg font-bold mb-2">❌ Помилка</p>
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={fetchInventory}
                className="px-4 py-2 bg-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/80 text-white text-sm font-bold rounded-lg transition-all active:scale-95"
              >
                Спробувати знову
              </button>
            </div>
          )}

          {/* Порожній стан */}
          {!loading && !error && filteredData.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="text-slate-400">
                <p className="text-2xl mb-2">📦</p>
                <p className="text-lg font-bold mb-1">
                  {selectedCategory === 'Всі' ? 'Інвентар порожній' : `Немає предметів у категорії "${selectedCategory}"`}
                </p>
                <p className="text-sm">
                  {selectedCategory === 'Всі'
                    ? 'Запустіть бота з нодою сканування інвентаря'
                    : 'Додайте предмети до цієї категорії у вкладці "Всі інвентарі"'}
                </p>
              </div>
            </div>
          )}

          {/* Сітка предметів інвентарю */}
          {!loading && !error && filteredData.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {filteredData.map((item, index) => {
                // Витягуємо ім'я предмета з URL зображення для tooltip
                const itemName = extractItemName(item.image);
                return (
                  <div
                    key={index}
                    className="relative flex flex-col items-center justify-center p-2 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 hover:border-indigo-500/30 transition-all group cursor-default"
                  >
                    {/* Зображення предмета */}
                    <div className="relative w-full aspect-square rounded-md overflow-hidden bg-slate-900/50">
                      <img
                        src={item.image}
                        alt={itemName}
                        className="w-full h-full object-contain"
                        onError={handleImageError}
                        loading="lazy"
                      />

                      {/* Бейдж з кількістю — верхній правий кут */}
                      <div className="absolute top-0.5 right-0.5 px-1.5 py-0.5 bg-indigo-600/90 backdrop-blur-sm text-white text-xs font-bold rounded shadow-lg border border-indigo-400/30">
                        {item.number % 1 === 0 ? item.number : item.number.toFixed(1)}
                      </div>
                    </div>

                    {/* Tooltip з іменем — з'являється при наведенні знизу картки */}
                    <div className="
                      absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                      px-2 py-1 rounded-md
                      bg-slate-900/95 backdrop-blur-sm
                      text-white text-[10px] font-semibold
                      border border-slate-600/50
                      shadow-xl
                      whitespace-nowrap
                      pointer-events-none
                      opacity-0 group-hover:opacity-100
                      scale-95 group-hover:scale-100
                      transition-all duration-150
                      z-50
                    ">
                      {/* Ім'я предмета */}
                      {itemName}
                      {/* Маленький трикутник-стрілка вниз */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
