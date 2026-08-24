import { useState, useEffect, useCallback } from 'react';
import { Flame, ChefHat, Save, RotateCcw, ImageIcon, Apple } from 'lucide-react';
import { Input } from './ui/input';

// ─── Дані рецептів ────────────────────────────────────────────────────────────
const FIRE_PIT_RECIPES = [
  "Furikake Sprinkle", "Mashed Potato", "Pumpkin Soup", "Reindeer Carrot",
  "Mushroom Soup", "Popcorn", "Bumpkin Broth", "Cabbers n Mash",
  "Boiled Eggs", "Kale Stew", "Kale Omelette", "Gumbo",
  "Rapid Roast", "Fried Tofu", "Rice Bun", "Antipasto",
  "Pizza Margherita", "Rhubarb Tart"
];

const KITCHEN_RECIPES = [
  "Surimi Rice Bowl", "Creamy Crab Bite", "Crimstone Infused Fish Oil",
  "Sunflower Crunch", "Mushroom Jacket Potatoes", "Fruit Salad",
  "Pancakes", "Roast Veggies", "Cauliflower Burger", "Club Sandwich",
  "Bumpkin Salad", "Bumpkin ganoush", "Goblin's Treat", "Chowder",
  "Bumpkin Roast", "Goblin Brunch", "Beetroot Blaze", "Steamed Red Rice",
  "Tofu Scramble", "Fried Calamari", "Fish Burger", "Fish Omelette",
  "Ocean's Olive", "Seafood Basket", "Fish n Chips", "Sushi Roll",
  "Caprese Salad", "Spaghetti al Limone"
];

// ─── Типи ─────────────────────────────────────────────────────────────────────
interface FoodItemSettings {
  enabled: boolean;
  imageName: string;
}

interface RecipeImagesData {
  firePit: Record<string, string>;
  kitchen: Record<string, string>;
  food: Record<string, FoodItemSettings>;
  [key: string]: any;
}

// ─── Компонент однієї страви ──────────────────────────────────────────────────
const RecipeImageRow = ({
  recipeName,
  value,
  onChange,
  accentColor,
}: {
  recipeName: string;
  value: string;
  onChange: (val: string) => void;
  accentColor: string;
}) => (
  <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-slate-900/50 hover:bg-slate-800/50 transition-colors group">
    <ImageIcon size={11} className="text-slate-600 shrink-0 group-hover:text-slate-400" />
    <span
      className="text-[10px] font-medium flex-1 truncate"
      style={{ color: accentColor + 'cc' }}
      title={recipeName}
    >
      {recipeName}
    </span>
    <Input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="назва_зображення.png"
      className="h-6 w-[180px] text-[10px] bg-slate-950 border-slate-700 px-2 font-mono text-slate-300 shrink-0"
    />
  </div>
);

// ─── Компонент одного предмету їжі ───────────────────────────────────────────
const FoodItemRow = ({
  itemName,
  imagePath,
  settings,
  baseUrl,
  onChange,
}: {
  itemName: string;
  imagePath: string;
  settings: FoodItemSettings;
  baseUrl: string;
  onChange: (settings: FoodItemSettings) => void;
}) => {
  const imageUrl = imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`;

  return (
    <div className={`flex items-center gap-2 py-2 px-2 rounded-md transition-colors group ${
      settings.enabled
        ? 'bg-amber-500/10 border border-amber-500/30'
        : 'bg-slate-900/50 hover:bg-slate-800/50 border border-transparent'
    }`}>
      {/* Чекбокс */}
      <input
        type="checkbox"
        checked={settings.enabled}
        onChange={e => onChange({ ...settings, enabled: e.target.checked })}
        className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
      />
      {/* Зображення предмету */}
      <img
        src={imageUrl}
        alt={itemName}
        className="w-8 h-8 object-contain rounded shrink-0 bg-slate-900/50"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {/* Назва предмету */}
      <span
        className={`text-[10px] font-medium flex-1 truncate ${settings.enabled ? 'text-amber-200' : 'text-slate-500'}`}
        title={itemName}
      >
        {itemName}
      </span>
      {/* Поле imageName для кліку */}
      <Input
        type="text"
        value={settings.imageName}
        onChange={e => onChange({ ...settings, imageName: e.target.value })}
        placeholder="назва_зображення.png"
        className="h-6 w-[160px] text-[10px] bg-slate-950 border-slate-700 px-2 font-mono text-slate-300 shrink-0"
        title="Назва зображення для кліку"
      />
    </div>
  );
};

// ─── Головний компонент ───────────────────────────────────────────────────────
export const RecipeImagesSettings = () => {
  const [data, setData] = useState<RecipeImagesData>({ firePit: {}, kitchen: {}, food: {} });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recipes' | 'food'>('recipes');

  // Предмети їжі з категорій інвентарю
  const [foodItems, setFoodItems] = useState<{ name: string; imagePath: string }[]>([]);
  const [baseUrl, setBaseUrl] = useState('');

  // Завантаження налаштувань страв та предметів їжі
  useEffect(() => {
    const loadAll = async () => {
      try {
        // Завантажуємо налаштування зображень
        const imgRes = await fetch('/api/recipe-images');
        const imgData = await imgRes.json();
        setData({
          firePit: imgData.firePit || {},
          kitchen: imgData.kitchen || {},
          food: imgData.food || {},
        });

        // Завантажуємо категорії та знаходимо предмети з категорії "їжа"/"food"
        const [catRes, projectsRes] = await Promise.all([
          fetch('/api/inventory/categories'),
          fetch('/api/projects'),
        ]);

        const catData = await catRes.json();
        const projects: string[] = await projectsRes.json();
        const itemToCategories: Record<string, string[]> = catData.itemToCategories || {};

        // Знаходимо предмети категорії "їжа"/"food"
        const foodCategoryItems = Object.entries(itemToCategories)
          .filter(([, cats]) => cats.some((c: string) =>
            c.toLowerCase().includes('їжа') || c.toLowerCase().includes('food') || c.toLowerCase() === 'їжа'
          ))
          .map(([itemName]) => itemName);

        // Якщо є проекти — беремо інвентар першого і знаходимо зображення предметів
        if (projects.length > 0 && foodCategoryItems.length > 0) {
          const firstProject = projects[0];
          const baseUrlVal = window.location.origin;
          setBaseUrl(baseUrlVal);

          const invRes = await fetch(`/api/inventory/${firstProject}?source=inventory`);
          const invData = await invRes.json();
          const inventoryItems: { image: string; name?: string }[] = invData.data || [];

          // Шукаємо зображення для кожного предмету їжі
          const items = foodCategoryItems.map(name => {
            const found = inventoryItems.find(item => {
              const imgName = item.image?.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
              return imgName.toLowerCase() === name.toLowerCase() ||
                     item.image?.toLowerCase().includes(name.toLowerCase());
            });
            return { name, imagePath: found?.image || `/api/im/${name}.png` };
          });

          setFoodItems(items);
        } else if (foodCategoryItems.length === 0) {
          // Якщо немає категорії їжа — показуємо порожній список з підказкою
          setFoodItems([]);
        }
      } catch (e) {
        console.error('Failed to load food settings:', e);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const updateFirePit = useCallback((recipe: string, val: string) => {
    setData(prev => ({ ...prev, firePit: { ...prev.firePit, [recipe]: val } }));
    setSaved(false);
  }, []);

  const updateKitchen = useCallback((recipe: string, val: string) => {
    setData(prev => ({ ...prev, kitchen: { ...prev.kitchen, [recipe]: val } }));
    setSaved(false);
  }, []);

  const updateFoodItem = useCallback((itemName: string, settings: FoodItemSettings) => {
    setData(prev => ({ ...prev, food: { ...prev.food, [itemName]: settings } }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    try {
      const csrfToken = document.cookie.match(/csrfToken=([^;]+)/)?.[1] || '';
      const res = await fetch('/api/recipe-images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error('Failed to save recipe images:', e);
    }
  };

  const handleReset = (section: 'firePit' | 'kitchen' | 'food') => {
    setData(prev => ({ ...prev, [section]: {} }));
    setSaved(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-[11px]">
        Завантаження налаштувань страв...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Заголовок + кнопка збереження */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold text-slate-200 mb-0.5">Зображення страв та їжа</div>
          <div className="text-[10px] text-slate-500 leading-relaxed max-w-xs">
            Вкажіть назви файлів зображень для страв і їжі.
          </div>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all shrink-0 ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
          }`}
        >
          <Save size={12} />
          {saved ? 'Збережено!' : 'Зберегти'}
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 border-b border-slate-800 pb-0">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-t-md transition-all -mb-px ${
            activeTab === 'recipes'
              ? 'bg-slate-800 text-slate-200 border border-slate-700 border-b-slate-800'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ChefHat size={11} />
          Страви
        </button>
        <button
          onClick={() => setActiveTab('food')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-t-md transition-all -mb-px ${
            activeTab === 'food'
              ? 'bg-slate-800 text-amber-200 border border-slate-700 border-b-slate-800'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Apple size={11} />
          Їжа
          {Object.values(data.food).filter(f => f.enabled).length > 0 && (
            <span className="bg-amber-500/30 text-amber-300 text-[9px] px-1.5 rounded-full ml-0.5">
              {Object.values(data.food).filter(f => f.enabled).length}
            </span>
          )}
        </button>
      </div>

      {/* Вкладка: Страви */}
      {activeTab === 'recipes' && (
        <div className="space-y-5">
          {/* Fire Pit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame size={13} className="text-orange-400" />
                <span className="text-[11px] font-bold text-orange-300 uppercase tracking-wide">Fire Pit</span>
                <span className="text-[9px] text-slate-600">{FIRE_PIT_RECIPES.length} страв</span>
              </div>
              <button
                onClick={() => handleReset('firePit')}
                className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                title="Очистити всі зображення Fire Pit"
              >
                <RotateCcw size={10} />
                Скинути
              </button>
            </div>
            <div className="space-y-0.5 bg-slate-900/30 rounded-lg border border-orange-500/10 p-2 max-h-[280px] overflow-y-auto custom-scrollbar">
              {FIRE_PIT_RECIPES.map(recipe => (
                <RecipeImageRow
                  key={recipe}
                  recipeName={recipe}
                  value={data.firePit[recipe] || ''}
                  onChange={val => updateFirePit(recipe, val)}
                  accentColor="#fb923c"
                />
              ))}
            </div>
          </div>

          {/* Kitchen */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat size={13} className="text-purple-400" />
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wide">Kitchen</span>
                <span className="text-[9px] text-slate-600">{KITCHEN_RECIPES.length} страв</span>
              </div>
              <button
                onClick={() => handleReset('kitchen')}
                className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                title="Очистити всі зображення Kitchen"
              >
                <RotateCcw size={10} />
                Скинути
              </button>
            </div>
            <div className="space-y-0.5 bg-slate-900/30 rounded-lg border border-purple-500/10 p-2 max-h-[280px] overflow-y-auto custom-scrollbar">
              {KITCHEN_RECIPES.map(recipe => (
                <RecipeImageRow
                  key={recipe}
                  recipeName={recipe}
                  value={data.kitchen[recipe] || ''}
                  onChange={val => updateKitchen(recipe, val)}
                  accentColor="#c084fc"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Вкладка: Їжа */}
      {activeTab === 'food' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Apple size={13} className="text-amber-400" />
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">Предмети їжі</span>
              {foodItems.length > 0 && (
                <span className="text-[9px] text-slate-600">{foodItems.length} предметів</span>
              )}
            </div>
            {foodItems.length > 0 && (
              <button
                onClick={() => handleReset('food')}
                className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                title="Скинути всі налаштування їжі"
              >
                <RotateCcw size={10} />
                Скинути
              </button>
            )}
          </div>

          {foodItems.length === 0 ? (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-center space-y-2">
              <Apple size={24} className="text-amber-500/40 mx-auto" />
              <div className="text-[11px] text-amber-300/60 font-medium">Немає предметів їжі</div>
              <div className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                Перейдіть у <span className="text-slate-400 font-medium">Всі Інвентарі</span>, виберіть предмети їжі
                та назначте їм категорію <span className="text-amber-400 font-bold">"їжа"</span> або <span className="text-amber-400 font-bold">"food"</span>.
                Після цього вони з'являться тут.
              </div>
            </div>
          ) : (
            <>
              <div className="text-[9px] text-slate-500 bg-slate-900/50 rounded p-2 flex items-start gap-1.5">
                <span className="text-amber-400 shrink-0">ℹ️</span>
                <span>Відмітьте предмети ✓, які нода має їсти. У полі праворуч вкажіть частину назви зображення для кліку.</span>
              </div>
              <div className="space-y-1 bg-slate-900/30 rounded-lg border border-amber-500/10 p-2 max-h-[360px] overflow-y-auto custom-scrollbar">
                {foodItems.map(item => (
                  <FoodItemRow
                    key={item.name}
                    itemName={item.name}
                    imagePath={item.imagePath}
                    baseUrl={baseUrl}
                    settings={data.food[item.name] || { enabled: false, imageName: '' }}
                    onChange={settings => updateFoodItem(item.name, settings)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RecipeImagesSettings;
