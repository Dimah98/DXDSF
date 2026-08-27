import { useState, useEffect, useCallback } from 'react'; // Імпортуємо хуки React для керування станом та ефектами
import './InventoryOverview.css'; // Імпортуємо файл стилів для компонента

interface ResourceMetadata { // Описуємо структуру метаданих ресурсу
  image: string; // URL зображення ресурсу
  index: number; // Порядковий індекс ресурсу
} // Кінець інтерфейсу ResourceMetadata

interface InventoryOverviewData { // Описуємо структуру агрегованих даних з сервера
  accounts: string[]; // Список акаунтів (імен проектів)
  resources: ResourceMetadata[]; // Список усіх ресурсів інвентарю
  data: (number | null)[][]; // Двовимірний масив кількості ресурсів по акаунтах
  timestamp: number; // Таймстемп оновлення
} // Кінець інтерфейсу InventoryOverviewData

interface CategoriesData { // Інтерфейс для зчитування даних категорій з сервера
  categories: string[]; // Список усіх категорій
  itemToCategories: Record<string, string[]>; // Мапінг назви предмета на масив його категорій
} // Кінець інтерфейсу CategoriesData

const AUTO_REFRESH_INTERVAL = 60000; // Інтервал для авто-оновлення (60 секунд)

const extractResourceName = (imageUrl: string): string => { // Функція для отримання людської назви предмета з шляху картинки
  const filename = imageUrl.split('/').pop() || ''; // Беремо останній елемент шляху (назву файлу)
  const nameWithoutExt = filename.replace(/\.[^.]+$/, ''); // Видаляємо розширення файлу (.png)
  return nameWithoutExt.replace(/_/g, ' '); // Замінюємо підкреслення на пробіли
}; // Кінець функції extractResourceName

const extractResourceKey = (imageUrl: string): string => { // Функція для отримання унікального ключа предмета
  const filename = imageUrl.split('/').pop() || ''; // Витягуємо назву файлу з шляху
  return decodeURIComponent(filename.replace(/\.[^.]+$/, '')); // Видаляємо розширення файлу та декодуємо
}; // Кінець функції extractResourceKey

import { ArrowLeft } from 'lucide-react';
const InventoryOverview = ({ currentView, setCurrentView }: any) => { // Основний компонент сторінки зведеного інвентарю
  const [data, setData] = useState<InventoryOverviewData | null>(null); // Стейт для даних інвентарів
  const [loading, setLoading] = useState<boolean>(true); // Стейт для відображення індикатора завантаження
  const [error, setError] = useState<string | null>(null); // Стейт для збереження помилок
  const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(false); // Стейт для приховування порожніх стовпців
  const [dataSource, setDataSource] = useState<'inventory' | 'stock'>('inventory'); // Стейт для джерела даних
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now()); // Стейт для часу останнього оновлення
  const [categories, setCategories] = useState<string[]>([]); // Стейт для списку категорій
  const [itemToCategories, setItemToCategories] = useState<Record<string, string[]>>({}); // Стейт для зв'язків предметів з категоріями
  const [selectedCategory, setSelectedCategory] = useState<string>('Всі'); // Стейт для поточної вибраної категорії
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState<boolean>(false); // Стейт для відкритості модалки категорій
  const [newCategoryName, setNewCategoryName] = useState<string>(''); // Стейт для введення імені нової категорії
  const [editingItem, setEditingItem] = useState<{ name: string; key: string; image: string } | null>(null); // Стейт для редагування категорій конкретного предмета

  const fetchCategories = useCallback(async () => { // Функція завантаження категорій з бекенду
    try { // Спроба виконати HTTP запит
      const response = await fetch('/api/inventory/categories'); // Здійснюємо GET запит до API категорій
      if (response.ok) { // Якщо відповідь успішна
        const result: CategoriesData = await response.json(); // Парсимо JSON відповідь
        setCategories(result.categories || []); // Записуємо категорії в стейт
        setItemToCategories(result.itemToCategories || {}); // Записуємо зв'язки в стейт
      } // Кінець перевірки успішності
    } catch (err) { // Обробка помилок запиту
      console.error('Failed to fetch categories:', err); // Виводимо помилку в консоль
    } // Кінець блоку catch
  }, []); // Кінець fetchCategories

  const saveCategories = async (newCats: string[], newMapping: Record<string, string[]>) => { // Функція для збереження категорій на бекенді
    try { // Спроба надіслати дані
      const response = await fetch('/api/inventory/categories', { // Здійснюємо POST запит
        method: 'POST', // Вказуємо метод POST
        headers: { // Заголовки запиту
          'Content-Type': 'application/json', // Вказуємо формат JSON
        }, // Кінець заголовків
        body: JSON.stringify({ categories: newCats, itemToCategories: newMapping }), // Серіалізуємо дані категорій у тіло запиту
      }); // Кінець fetch
      if (response.ok) { // Якщо збереження пройшло успішно
        setCategories(newCats); // Оновлюємо стейт категорій локально
        setItemToCategories(newMapping); // Оновлюємо стейт зв'язків локально
      } // Кінець перевірки успішності
    } catch (err) { // Обробка помилок збереження
      console.error('Failed to save categories:', err); // Виводимо помилку в консоль
    } // Кінець блоку catch
  }; // Кінець saveCategories

  const fetchData = useCallback(async () => { // Функція завантаження даних інвентарів з сервера
    setLoading(true); // Включаємо індикатор завантаження
    setError(null); // Очищуємо попередні помилки
    try { // Спроба виконати HTTP запит
      const controller = new AbortController(); // Створюємо контролер для відміни запиту
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Ліміт часу на запит — 5 секунд
      const response = await fetch(`/api/inventory/overview?source=${dataSource}`, { // Виконуємо GET запит до API зведення інвентарю з параметром джерела
        method: 'GET', // Вказуємо HTTP метод
        headers: { 'Content-Type': 'application/json' }, // Встановлюємо заголовки
        credentials: 'include', // Дозволяємо передачу кук/сесії
        signal: controller.signal, // Передаємо сигнал відміни
      }); // Кінець fetch
      clearTimeout(timeoutId); // Скасовуємо таймер тайм-ауту
      if (response.status === 401) { // Якщо користувач не авторизований
        setError('Не авторизовано. Увійдіть в систему.'); // Встановлюємо текст помилки
        setLoading(false); // Вимикаємо індикатор завантаження
        setData({ accounts: [], resources: [], data: [], timestamp: Date.now() }); // Очищуємо дані
        return; // Перериваємо виконання
      } // Кінець перевірки авторизації
      if (!response.ok) { // Якщо сталася помилка сервера
        const errorData = await response.json().catch(() => null); // Намагаємося спарсити опис помилки
        setError(errorData?.error || `HTTP error: ${response.status}`); // Встановлюємо помилку
        setLoading(false); // Вимикаємо завантаження
        setData({ accounts: [], resources: [], data: [], timestamp: Date.now() }); // Очищуємо дані
        return; // Виходимо
      } // Кінець перевірки статусу
      const result: InventoryOverviewData = await response.json(); // Отримуємо результат у форматі JSON
      setData(result); // Записуємо дані у стейт
      setLastRefreshTime(Date.now()); // Оновлюємо час останнього оновлення
    } catch (err) { // Обробка виняткових ситуацій
      console.error('Fetch error:', err); // Виводимо помилку в консоль
      if (err instanceof Error) { // Якщо це об'єкт помилки
        if (err.name === 'AbortError') { // Якщо запит відмінено за тайм-аутом
          setError('Тайм-аут запиту. Сервер не відповідає.'); // Повідомляємо про тайм-аут
        } else { // Для інших помилок типу Error
          setError(`Не вдалося завантажити дані: ${err.message}`); // Показуємо повідомлення
        } // Кінець перевірки назви помилки
      } else { // Якщо помилка невідомого типу
        setError('Не вдалося завантажити дані. Перевірте з\'єднання.'); // Загальне повідомлення
      } // Кінець перевірки типу помилки
      setData({ accounts: [], resources: [], data: [], timestamp: Date.now() }); // Повертаємо пусті дані
    } finally { // Блок завершення запиту
      setLoading(false); // У будь-якому випадку вимикаємо індикатор завантаження
    } // Кінець блоку try-catch-finally
  }, [dataSource]); // Кінець fetchData

  useEffect(() => { // Ефект при монтуванні компонента
    fetchData(); // Завантажуємо дані інвентарів
    fetchCategories(); // Завантажуємо категорії
  }, [fetchData, fetchCategories]); // Залежності ефекту

  useEffect(() => { // Ефект для автоматичного періодичного оновлення
    const intervalId = setInterval(() => { // Запускаємо інтервал
      fetchData(); // Оновлюємо дані інвентарів
    }, AUTO_REFRESH_INTERVAL); // Інтервал оновлення
    return () => clearInterval(intervalId); // Очищуємо інтервал при демонтажі
  }, [fetchData]); // Залежності ефекту

  const getResourceCategories = (imageUrl: string): string[] => {
    const resourceKey = extractResourceKey(imageUrl);
    if (itemToCategories[resourceKey] && itemToCategories[resourceKey].length > 0) {
      return itemToCategories[resourceKey];
    }
    const cleanKey = resourceKey.toLowerCase().trim();
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

  const visibleResourceIndices = data?.resources.map((resource, idx) => { // Визначаємо індекси ресурсів, які мають відображатися в таблиці
    if (selectedCategory !== 'Всі') { // Якщо обрано конкретну категорію
      const itemCats = getResourceCategories(resource.image); // Отримуємо список категорій предмета
      if (selectedCategory === 'без категорії') { // Якщо вибрано категорію "без категорії"
        if (itemCats.length > 0 && !itemCats.includes('без категорії')) { // Якщо предмет має інші категорії і не має категорії "без категорії"
          return -1; // Фільтруємо його зі списку
        } // Кінець перевірки
      } else { // Для всіх інших звичайних категорій
        if (!itemCats.includes(selectedCategory)) { // Якщо предмет не належить до поточної категорії
          return -1; // Повертаємо -1 (буде відфільтровано)
        } // Кінець перевірки належності
      } // Кінець перевірки типу категорії
    } // Кінець перевірки категорії
    if (!hideEmptyColumns) return idx; // Якщо приховування порожніх вимкнено, показуємо стовпець
    const isEmpty = data?.data.every((row) => { // Перевіряємо чи всі значення в колонці порожні або нульові
      const value = row[idx]; // Отримуємо значення клітинки
      return value === null || value === 0; // Повертаємо результат перевірки на нуль чи null
    }); // Кінець перевірки
    return isEmpty ? -1 : idx; // Якщо колонка порожня, повертаємо -1, інакше її індекс
  }).filter(idx => idx !== -1) || []; // Відфільтровуємо індекси, що дорівнюють -1

  const visibleResources = visibleResourceIndices.map(idx => data!.resources[idx]); // Створюємо масив метаданих видимих ресурсів

  const exportToCSV = () => { // Функція експорту видимих даних у CSV файл
    if (!data) return; // Якщо даних немає, виходимо
    const headers = ['Account', ...visibleResources.map(r => r.image)]; // Заголовки файлу CSV (Акаунт + зображення)
    const rows = data.accounts.map((account) => { // Проходимося по всіх акаунтах
      const accountIdx = data.accounts.indexOf(account); // Отримуємо індекс акаунту в системі
      const values = visibleResourceIndices.map(resourceIdx => { // Проходимося по видимих індексах ресурсів
        const value = data.data[accountIdx][resourceIdx]; // Отримуємо значення з масиву
        return value !== null ? value : ''; // Якщо null, повертаємо пустий рядок, інакше саме значення
      }); // Кінець мапінгу
      return [account, ...values]; // Формуємо рядок: ім'я акаунту та його значення
    }); // Кінець формування рядків
    const csvLines = [ // Збираємо весь контент CSV
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','), // Форматуємо заголовок
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')) // Форматуємо кожен рядок
    ]; // Кінець збору ліній
    const csvContent = csvLines.join('\n'); // Об'єднуємо рядки через перенесення
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); // Створюємо бінарний об'єкт
    const url = URL.createObjectURL(blob); // Отримуємо посилання на об'єкт в пам'яті
    const link = document.createElement('a'); // Створюємо тимчасовий HTML лінк
    link.href = url; // Задаємо посилання
    link.download = `inventory_overview_${Date.now()}.csv`; // Вказуємо ім'я завантажуваного файлу
    document.body.appendChild(link); // Додаємо лінк на сторінку
    link.click(); // Імітуємо клік по ньому
    document.body.removeChild(link); // Видаляємо лінк після завантаження
    URL.revokeObjectURL(url); // Вивільняємо пам'ять
  }; // Кінець функції exportToCSV

  const formatCellValue = (value: number | null): string => { // Форматування значення клітинки для показу
    if (value === null || value === 0) return '-'; // Якщо значення нуль або пусте, показуємо дефіс
    return (value % 1 === 0 ? value : value.toFixed(1)).toString(); // Повертаємо ціле число як є, а дробове — з одним знаком після коми
  }; // Кінець formatCellValue

  if (loading && !data) { // Якщо триває завантаження і немає старих даних
    return ( // Повертаємо спинер завантаження
      <div className="inventory-overview">
      <button onClick={() => setCurrentView('editor')} className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-lg">
        <ArrowLeft size={18} />
        До Редактора
      </button>
        <div className="inventory-overview__loading">
          <div className="inventory-overview__spinner"></div>
          <p>Завантаження даних інвентаря...</p>
        </div>
      </div>
    ); // Кінець повернення JSX
  } // Кінець перевірки завантаження

  if (error && !data) { // Якщо сталася помилка і немає старих даних
    return ( // Повертаємо інтерфейс з помилкою
      <div className="inventory-overview">
        <div className="inventory-overview__error">
          <p className="inventory-overview__error-message">{error}</p>
          <button className="inventory-overview__button" onClick={fetchData}>Спробувати знову</button>
        </div>
      </div>
    ); // Кінець повернення JSX
  } // Кінець перевірки помилки

  return ( // Повертаємо головний JSX компонента
    <div className="inventory-overview">
      <div className="inventory-overview__toolbar">
        <div className="inventory-overview__toolbar-left">
          <button 
            onClick={() => setCurrentView('editor')} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors shadow shrink-0 border border-slate-700 mr-1"
            title="Повернутися до Редактора"
          >
            <ArrowLeft size={14} />
            <span>Редактор</span>
          </button>
          <div className="inventory-overview__categories-tabs">
            <button
              className={`inventory-overview__category-tab ${selectedCategory === 'Всі' ? 'inventory-overview__category-tab--active' : ''}`}
              onClick={() => setSelectedCategory('Всі')}
            >
              Всі
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`inventory-overview__category-tab ${selectedCategory === cat ? 'inventory-overview__category-tab--active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
            <button
              className="inventory-overview__button inventory-overview__button--manage-cats"
              onClick={() => setIsManageCategoriesOpen(true)}
              title="Налаштування категорій"
            >
              ⚙️ Категорії
            </button>
          </div>
          <label className="inventory-overview__checkbox-label">
            <input
              type="checkbox"
              checked={hideEmptyColumns}
              onChange={(e) => setHideEmptyColumns(e.target.checked)}
            />
            Приховати порожні ресурси
          </label>
          <span className="inventory-overview__count">
            {data?.accounts.length || 0} акаунтів
          </span>
        </div>
        <div className="inventory-overview__toolbar-right">
          <div className="flex items-center p-1 bg-black/40 border border-white/10 rounded-xl mr-2">
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
          <button className="inventory-overview__button" onClick={fetchData} disabled={loading}>
            {loading ? 'Оновлення...' : 'Оновити'}
          </button>
          <button 
            className="inventory-overview__button inventory-overview__button--export" 
            onClick={exportToCSV}
            disabled={!data || data.accounts.length === 0}
          >
            Експорт CSV
          </button>
        </div>
      </div>

      {error && data && (
        <div className="inventory-overview__error-banner">{error}</div>
      )}

      <div className="inventory-overview__table-container">
        <table className="inventory-overview__table">
          <thead>
            <tr>
              <th className="inventory-overview__header inventory-overview__header--account">Акаунт</th>
              {visibleResources.map((resource) => {
                const resourceName = extractResourceName(resource.image);
                const resourceKey = extractResourceKey(resource.image);
                return (
                  <th
                    key={resource.index}
                    className="inventory-overview__header inventory-overview__header--clickable"
                    onClick={() => setEditingItem({ name: resourceName, key: resourceKey, image: resource.image })}
                    title={`Натисніть, щоб додати ${resourceName} до категорій`}
                  >
                    <div className="inventory-overview__icon-wrapper" title={resourceName}>
                      <img src={resource.image} alt={resourceName} className="inventory-overview__resource-icon" />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data?.accounts.map((account) => {
              const accountIdx = data.accounts.indexOf(account);
              return (
                <tr key={account} className="inventory-overview__row">
                  <td className="inventory-overview__cell inventory-overview__cell--account">{account}</td>
                  {visibleResourceIndices.map((resourceIdx) => {
                    const value = data.data[accountIdx][resourceIdx];
                    return (
                      <td key={resourceIdx} className="inventory-overview__cell">
                        {formatCellValue(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="inventory-overview__footer">
          Останнє оновлення: {new Date(lastRefreshTime).toLocaleString('uk-UA')}
        </div>
      )}

      {isManageCategoriesOpen && (
        <div className="inventory-overview__modal-overlay">
          <div className="inventory-overview__modal">
            <div className="inventory-overview__modal-header">
              <h3>Налаштування категорій</h3>
              <button className="inventory-overview__modal-close" onClick={() => setIsManageCategoriesOpen(false)}>×</button>
            </div>
            <div className="inventory-overview__modal-body">
              <div className="inventory-overview__add-cat">
                <input
                  type="text"
                  placeholder="Нова категорія..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <button
                  className="inventory-overview__button"
                  onClick={() => {
                    const trimmed = newCategoryName.trim();
                    if (trimmed && !categories.includes(trimmed)) {
                      const updated = [...categories, trimmed];
                      saveCategories(updated, itemToCategories);
                      setNewCategoryName('');
                    }
                  }}
                >
                  Додати
                </button>
              </div>
              <ul className="inventory-overview__cat-list">
                {categories.map((cat) => (
                  <li key={cat} className="inventory-overview__cat-item">
                    <span>{cat}</span>
                    <button
                      className="inventory-overview__cat-delete"
                      onClick={() => {
                        const updated = categories.filter((c) => c !== cat);
                        const updatedMapping = { ...itemToCategories };
                        Object.keys(updatedMapping).forEach((key) => {
                          updatedMapping[key] = updatedMapping[key].filter((c) => c !== cat);
                        });
                        saveCategories(updated, updatedMapping);
                        if (selectedCategory === cat) {
                          setSelectedCategory('Всі');
                        }
                      }}
                    >
                      Видалити
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="inventory-overview__modal-overlay">
          <div className="inventory-overview__modal">
            <div className="inventory-overview__modal-header">
              <h3>Категорії для предмета</h3>
              <button className="inventory-overview__modal-close" onClick={() => setEditingItem(null)}>×</button>
            </div>
            <div className="inventory-overview__modal-body">
              <div className="inventory-overview__item-info">
                <img src={editingItem.image} alt={editingItem.name} className="inventory-overview__item-preview" />
                <strong>{editingItem.name}</strong>
              </div>
              <p>Оберіть категорії, до яких належить цей предмет:</p>
              {categories.length === 0 ? (
                <p className="inventory-overview__no-cats">Спочатку створіть категорії у налаштуваннях категорій.</p>
              ) : (
                <div className="inventory-overview__item-cats-checkboxes">
                  {categories.map((cat) => {
                    const itemCats = itemToCategories[editingItem.key] || [];
                    const isChecked = itemCats.includes(cat);
                    return (
                      <label key={cat} className="inventory-overview__cat-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updatedMapping = { ...itemToCategories };
                            const currentCats = updatedMapping[editingItem.key] || [];
                            if (e.target.checked) {
                              updatedMapping[editingItem.key] = [...currentCats, cat];
                            } else {
                              updatedMapping[editingItem.key] = currentCats.filter((c) => c !== cat);
                            }
                            saveCategories(categories, updatedMapping);
                          }}
                        />
                        {cat}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryOverview; // Експортуємо компонент за замовчуванням
