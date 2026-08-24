import React, { useState, useEffect, useRef } from 'react';
import { X, Save, RefreshCw, RotateCcw, Settings2, Package, Plus, ChevronDown, ChevronRight, Puzzle } from 'lucide-react';

interface IslandMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

interface MapItem {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  image?: string;
}

// Налаштування для кожного ТИПУ будівлі (загальні для всіх екземплярів)
interface BuildingTypeConfig {
  w: number;
  h: number;
  mapImage?: string;       // Назва зображення на карті (для відображення)
  inventoryImage?: string; // Назва зображення для кліку при розміщенні (крок 2)
  inventoryName?: string;  // Назва як записано в farm.inventory
}

// Формат layout.json
interface LayoutData {
  items: MapItem[];
  buildingTypes: Record<string, BuildingTypeConfig>;
}

interface InventoryGroup {
  category: 'building' | 'collectible';
  items: InventoryBuilding[];
}

interface InventoryBuilding {
  name: string;
  count: number;
  placedCount: number;
  image?: string;
  w: number;
  h: number;
  config: BuildingTypeConfig;
}

const BUILDING_SIZES: Record<string, [number, number]> = {
  'Tree': [2, 2], 'Water Well': [2, 2], 'Fruit Patch': [2, 2],
  'Compost Bin': [2, 2], 'Turbo Composter': [2, 2], 'Sunstone Rock': [2, 2],
  'Crimstone Rock': [2, 2], 'Big Apple': [2, 2], 'Big Orange': [2, 2],
  'Market': [3, 2], 'Workbench': [3, 2], 'Fire Pit': [3, 2],
  'Crafting Box': [3, 2], 'Smoothie Shack': [3, 2], 'Aging Shed': [3, 2],
  'Deli': [4, 3], 'Bakery': [4, 3], 'Hen House': [4, 3],
  'Kitchen': [4, 3], 'Town Center': [4, 3], 'Fish Market': [3, 3], 'House': [4, 4],
  'trees': [2, 2], 'crimstones': [2, 2], 'sunstones': [2, 2], 'fruitPatches': [2, 2],
  'flowerBeds': [3, 1],
  "Farmer's Monument": [3, 3], 'Squirrel': [2, 1], 'Stone Beetle': [1, 2],
};

const IMAGE_MAPPING: Record<string, string> = {
  'crops': 'Crop Plot.png', 'trees': 'Tree.png', 'stones': 'Stone Rock.png',
  'iron': 'Iron Rock.png', 'gold': 'Gold Rock.png', 'crimstones': 'Crimstone Rock.png',
  'sunstones': 'Sunstone Rock.png', 'flowers': 'Flower Bed.png',
  'fruitPatches': 'Fruit Patch.png', 'flowerBeds': 'Flower Bed.png', 'beehives': 'Beehive.png',
  'Town Center': 'Town Center.png', 'Workbench': 'Workbench.png', 'Market': 'Market.png',
  'Fire Pit': 'Fire Pit.png', 'House': 'House.png', 'Compost Bin': 'Compost Bin.png',
  'Kitchen': 'Kitchen.png', 'Aging Shed': 'Aging Shed.png', 'Water Well': 'Water Well.png',
  'Big Orange': 'Big Orange.png', 'Big Apple': 'Big Apple.png',
  'Basic Scarecrow': 'Basic Scarecrow.png', 'Fruit Patch': 'Fruit Patch.png',
  'Crimstone Rock': 'Crimstone Rock.png', 'Sunstone Rock': 'Sunstone Rock.png',
};

const GRID_SIZE = 40;
const OFFSET = 20;
const CELL = 32;

const getDefaultSize = (name: string): [number, number] => BUILDING_SIZES[name] ?? [1, 1];
const gameToPixel = (gx: number, gy: number) => ({ left: (gx + OFFSET) * CELL, top: (OFFSET - gy) * CELL });

const BUILDING_TYPES = ['building', 'collectible', 'resource'] as const;
const CAT_LABEL: Record<string, string> = { building: '🏗️ Будівлі', collectible: '🎨 Декор', resource: '🌳 Ресурси' };

export const IslandMapModal: React.FC<IslandMapModalProps> = ({ isOpen, onClose, projectName }) => {
  const [items, setItems] = useState<MapItem[]>([]);
  const [buildingTypes, setBuildingTypes] = useState<Record<string, BuildingTypeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  // Налаштування типу будівлі
  const [settingsTypeName, setSettingsTypeName] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<BuildingTypeConfig>({ w: 1, h: 1 });

  // Інвентар та розміщення
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
  const [placingBuilding, setPlacingBuilding] = useState<InventoryBuilding | null>(null);
  const [showInventory, setShowInventory] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ building: true, collectible: true, resource: true });

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) loadMapData(); }, [isOpen, projectName]);

  const getTypeConfig = (name: string): BuildingTypeConfig => {
    if (buildingTypes[name]) return buildingTypes[name];
    const [w, h] = getDefaultSize(name);
    return { w, h };
  };

  const loadMapData = async () => {
    setLoading(true); setError(null);
    try {
      const saveRes = await fetch(`/api/project-save/${projectName}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!saveRes.ok) {
        throw new Error(`Не вдалося завантажити збереження проекту (${saveRes.status})`);
      }
      const saveData = await saveRes.json();
      if (!saveData.success || !saveData.data) throw new Error('Помилка структури даних збереження');
      const farm = saveData.data.visitedFarmState || saveData.data;
      let parsed: MapItem[] = [];

      const parseObjects = (objData: any, category: string, type: string) => {
        if (!objData) return;
        Object.entries(objData).forEach(([name, arr]: [string, any]) => {
          arr.forEach((item: any) => {
            if (item.coordinates) {
              const [w, h] = getDefaultSize(name);
              parsed.push({ id: `${category}_${name}_${item.id}`, name, type, x: item.coordinates.x, y: item.coordinates.y, w, h, image: IMAGE_MAPPING[name] || `${name}.png` });
            }
          });
        });
      };

      parseObjects(farm.buildings, 'buildings', 'building');
      parseObjects(farm.collectibles, 'collectibles', 'collectible');

      const gridTypes = ['crops', 'trees', 'stones', 'iron', 'gold', 'crimstones', 'sunstones', 'fruitPatches', 'beehives'];
      gridTypes.forEach(type => {
        if (farm[type]) {
          Object.entries(farm[type]).forEach(([id, item]: [string, any]) => {
            if (item.x !== undefined && item.y !== undefined) {
              const [w, h] = getDefaultSize(type);
              parsed.push({ id: `${type}_${type}_${id}`, name: type, type, x: item.x, y: item.y, w, h, image: IMAGE_MAPPING[type] });
            }
          });
        }
      });

      const flowerBedsData = farm.flowers?.flowerBeds;
      if (flowerBedsData) {
        Object.entries(flowerBedsData).forEach(([id, item]: [string, any]) => {
          if (item.x !== undefined && item.y !== undefined) {
            parsed.push({ id: `flowerBeds_flowerBeds_${id}`, name: 'flowerBeds', type: 'flowerBeds', x: item.x, y: item.y, w: 3, h: 1, image: 'Flower Bed.png' });
          }
        });
      }

      // Завантажуємо layout: новий формат { items, buildingTypes } або старий масив
      let savedBuildingTypes: Record<string, BuildingTypeConfig> = {};
      try {
        const layoutRes = await fetch(`/api/project-map/${projectName}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const layoutData = await layoutRes.json();
        if (layoutData.success && layoutData.data) {
          const raw = layoutData.data;
          // Підтримуємо обидва формати
          const layoutItems: MapItem[] = Array.isArray(raw) ? raw : (raw.items ?? []);
          savedBuildingTypes = Array.isArray(raw) ? {} : (raw.buildingTypes ?? {});

          const layoutMap = new Map<string, MapItem>(layoutItems.map((i: any) => [i.id, i]));
          const parsedIds = new Set<string>();
          
          parsed = parsed.map(item => {
            parsedIds.add(item.id);
            const o = layoutMap.get(item.id);
            return o ? { ...item, x: o.x, y: o.y } : item;
          });

          // Додаємо предмети з макета, яких ще немає на карті гри (розміщені з інвентаря)
          layoutItems.forEach((layoutItem: any) => {
            if (!parsedIds.has(layoutItem.id)) {
              parsed.push(layoutItem);
            }
          });
        }
      } catch (e) {}

      // Застосовуємо розміри з buildingTypes до items
      const typedParsed = parsed.map(item => {
        const cfg = savedBuildingTypes[item.name];
        return cfg ? { ...item, w: cfg.w, h: cfg.h } : item;
      });

      setBuildingTypes(savedBuildingTypes);
      setItems(typedParsed);

      // Будуємо панель інвентаря
      buildInventoryGroups(farm, typedParsed, savedBuildingTypes);
    } catch (err: any) { setError(err.message || 'Failed to load'); } finally { setLoading(false); }
  };

  const buildInventoryGroups = (farm: any, currentItems: MapItem[], btypes: Record<string, BuildingTypeConfig>) => {
    const inventory = farm.inventory || {};

    const placedCounts: Record<string, number> = {};
    const placedTypes: Record<string, string> = {}; 
    currentItems.forEach(item => {
      placedCounts[item.name] = (placedCounts[item.name] || 0) + 1;
      placedTypes[item.name] = item.type;
    });

    const groups: InventoryGroup[] = [];

    // Збираємо всі можливі назви об'єктів для карти
    const mapNames = new Set<string>([...Object.keys(placedTypes), ...Object.keys(btypes)]);
    
    // Знаходимо всі інвентарні імена, які вже використовуються як inventoryName у btypes
    const usedInventoryNames = new Set<string>();
    Object.values(btypes).forEach(cfg => {
      if (cfg.inventoryName) {
        usedInventoryNames.add(cfg.inventoryName);
      }
    });

    // Додаємо з інвентаря ті, що мають відомі розміри (якщо ще не додані і не використовуються як alias)
    Object.keys(inventory).forEach(invKey => {
      if (BUILDING_SIZES[invKey] && !usedInventoryNames.has(invKey)) {
        mapNames.add(invKey);
      }
    });

    // Групуємо за категорією
    const itemsByCategory: Record<string, InventoryBuilding[]> = { building: [], collectible: [], resource: [] };

    mapNames.forEach(mapName => {
      const cfg = btypes[mapName] || { w: getDefaultSize(mapName)[0], h: getDefaultSize(mapName)[1] };
      
      // Назва в інвентарі (якщо не вказано — беремо назву карти)
      const invName = cfg.inventoryName || mapName;
      const count = Number(inventory[invName]) || 0;
      const placed = placedCounts[mapName] || 0;

      if (count > 0 || placed > 0) {
        let itemType = placedTypes[mapName];
        if (!itemType) {
          // Якщо об'єкт ще не розміщений, намагаємося визначити категорію
          // Всі нові об'єкти за замовчуванням відносимо до building (крім відомих ресурсів, але ми їх вже відфільтрували)
          itemType = 'building'; 
        }

        if (itemType !== 'building' && itemType !== 'collectible') {
          itemType = 'resource';
        }

        if (itemsByCategory[itemType]) {
          itemsByCategory[itemType].push({
            name: mapName, 
            count, 
            placedCount: placed,
            image: IMAGE_MAPPING[mapName] || `${mapName}.png`,
            w: cfg.w, h: cfg.h, config: cfg
          });
        }
      }
    });

    BUILDING_TYPES.forEach(cat => {
      if (itemsByCategory[cat].length > 0) {
        groups.push({ category: cat, items: itemsByCategory[cat] });
      }
    });

    setInventoryGroups(groups);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Зберігаємо новий формат: { items, buildingTypes }
      const payload: LayoutData = { items, buildingTypes };
      const res = await fetch(`/api/project-map/${projectName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Помилка сервера: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Помилка збереження');
      onClose();
    } catch (err: any) { setError(err.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!window.confirm('Видалити макет і скинути до стану гри?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/project-map/${projectName}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error(`Помилка сервера: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Помилка скидання');
      await loadMapData();
    } catch (err: any) { setError(err.message || 'Failed to reset'); } finally { setSaving(false); }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (placingBuilding) return;
    e.stopPropagation();
    setDraggingId(id);
    setSettingsTypeName(null);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setDragOffset({ dx: e.clientX - rect.left, dy: e.clientY - rect.top });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId || !gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const pixelX = e.clientX - gridRect.left - dragOffset.dx;
    const pixelY = e.clientY - gridRect.top - dragOffset.dy;
    const newGameX = Math.round(pixelX / CELL) - OFFSET;
    const newGameY = OFFSET - Math.round(pixelY / CELL);
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, x: newGameX, y: newGameY } : item));
    setDraggingId(null);
  };

  const handleGridClick = (e: React.MouseEvent) => {
    if (!placingBuilding || !gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const pixelX = e.clientX - gridRect.left;
    const pixelY = e.clientY - gridRect.top;
    const newGameX = Math.round(pixelX / CELL) - OFFSET;
    const newGameY = OFFSET - Math.round(pixelY / CELL);

    const cfg = getTypeConfig(placingBuilding.name);
    const newItem: MapItem = {
      id: `buildings_${placingBuilding.name}_inv_${Date.now()}`,
      name: placingBuilding.name,
      type: 'building',
      x: newGameX, y: newGameY,
      w: cfg.w, h: cfg.h,
      image: IMAGE_MAPPING[placingBuilding.name] || `${placingBuilding.name}.png`,
    };
    setItems(prev => [...prev, newItem]);
    setPlacingBuilding(null);
  };

  // Відкрити панель налаштувань типу
  const openTypeSettings = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = buildingTypes[name];
    const [defW, defH] = getDefaultSize(name);
    setSettingsForm({
      w: existing?.w ?? defW,
      h: existing?.h ?? defH,
      mapImage: existing?.mapImage ?? '',
      inventoryImage: existing?.inventoryImage ?? '',
      inventoryName: existing?.inventoryName ?? '',
    });
    setSettingsTypeName(settingsTypeName === name ? null : name);
  };

  const saveTypeSettings = (name: string) => {
    setBuildingTypes(prev => ({ ...prev, [name]: { ...settingsForm } }));
    // Оновити розміри всіх items цього типу
    setItems(prev => prev.map(item =>
      item.name === name ? { ...item, w: settingsForm.w, h: settingsForm.h } : item
    ));
    setSettingsTypeName(null);
  };

  // Унікальні типи будівель що є на карті
  const uniqueItemTypes = Array.from(new Set(items.map(i => i.name))).sort();

  if (!isOpen) return null;
  const gridPx = GRID_SIZE * CELL;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-11/12 max-w-7xl h-[92vh] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20 shrink-0">
          <h2 className="text-xl font-bold text-foreground">Карта острова: {projectName}</h2>
          <div className="flex items-center gap-2">
            {placingBuilding && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm">
                <Plus size={14} />
                Клікни на карті: <strong>{placingBuilding.name}</strong>
                <button onClick={() => setPlacingBuilding(null)} className="ml-1 hover:text-red-400">✕</button>
              </div>
            )}
            <button onClick={loadMapData} disabled={loading || saving} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Оновити з гри">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleReset} disabled={loading || saving} className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-md transition-colors disabled:opacity-50">
              <RotateCcw size={16} /> Скинути
            </button>
            <button onClick={handleSave} disabled={loading || saving} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors disabled:opacity-50">
              <Save size={16} /> {saving ? 'Збереження...' : 'Зберегти'}
            </button>
            <button onClick={onClose} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Карта */}
          <div className="flex-1 overflow-auto bg-[#1a1c23] p-6">
            {error && <div className="mb-4 bg-red-500/20 text-red-500 px-4 py-2 rounded-md border border-red-500/50">{error}</div>}
            {loading ? (
              <div className="flex items-center justify-center h-full"><RefreshCw size={48} className="animate-spin text-muted-foreground/50" /></div>
            ) : (
              <div className="mx-auto w-fit">
                <div
                  ref={gridRef}
                  className={`relative border border-white/10 rounded-lg overflow-hidden ${placingBuilding ? 'cursor-crosshair' : ''}`}
                  style={{ width: gridPx, height: gridPx }}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={placingBuilding ? handleGridClick : undefined}
                >
                  {/* Сітка */}
                  {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                    const cx = i % GRID_SIZE, cy = Math.floor(i / GRID_SIZE);
                    return <div key={i} className="absolute bg-black/40 border border-white/5" style={{ left: cx * CELL, top: cy * CELL, width: CELL, height: CELL }} title={`${cx - OFFSET}, ${OFFSET - cy}`} />;
                  })}

                  {/* Будівлі */}
                  {items.map(item => {
                    const { left, top } = gameToPixel(item.x, item.y);
                    const isDragging = draggingId === item.id;
                    const cfg = getTypeConfig(item.name);
                    const imgSrc = cfg.mapImage ? `/api/im/${cfg.mapImage}` : (item.image ? `/api/im/${item.image}` : null);
                    const isSettingsOpen = settingsTypeName === item.name;

                    return (
                      <div key={item.id}
                        draggable={!placingBuilding}
                        onDragStart={e => handleDragStart(e, item.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className={`absolute rounded-sm border transition-all select-none group ${isDragging ? 'opacity-20 border-white/40' : 'border-white/30 hover:border-yellow-400/80 hover:brightness-125'}`}
                        style={{ left, top, width: item.w * CELL, height: item.h * CELL, zIndex: isSettingsOpen ? 20 : (isDragging ? 1 : 5), background: 'rgba(0,0,0,0.25)', cursor: placingBuilding ? 'crosshair' : 'move' }}
                        title={`${item.name} (${item.x}, ${item.y})`}
                      >
                        {imgSrc && <img src={imgSrc} alt={item.name} className="w-full h-full object-contain pointer-events-none drop-shadow-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        {!imgSrc && (
                          <div className={`w-full h-full flex items-center justify-center rounded-sm ${item.type === 'crops' ? 'bg-amber-700/70' : item.type === 'trees' ? 'bg-green-700/70' : item.type === 'building' ? 'bg-blue-700/70' : 'bg-purple-700/70'}`}>
                            <span className="text-white font-bold text-[9px] text-center px-1">{item.name}</span>
                          </div>
                        )}

                        {/* Кнопка налаштувань типу */}
                        {!placingBuilding && (
                          <button
                            onClick={e => openTypeSettings(item.name, e)}
                            className="absolute top-0.5 right-0.5 z-10 p-0.5 bg-black/70 hover:bg-yellow-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Налаштування типу "${item.name}"`}
                          >
                            <Settings2 size={10} className="text-white" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Панель налаштувань типу (виводиться поверх карти) */}
                  {settingsTypeName && (() => {
                    const item = items.find(i => i.name === settingsTypeName);
                    if (!item) return null;
                    const { left, top } = gameToPixel(item.x, item.y);
                    return (
                      <div
                        className="absolute bg-slate-900 border border-yellow-500/60 rounded-lg p-3 shadow-2xl z-30 min-w-[240px]"
                        style={{ left: left + item.w * CELL + 4, top, pointerEvents: 'all' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="text-[11px] font-bold text-yellow-400 mb-2">⚙️ Тип: {settingsTypeName} <span className="text-slate-400 font-normal">(всі екземпляри)</span></div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 w-20 shrink-0">Ширина W:</span>
                            <input type="number" min={1} max={10} value={settingsForm.w}
                              onChange={e => setSettingsForm(f => ({ ...f, w: parseInt(e.target.value) || 1 }))}
                              className="flex-1 bg-slate-800 text-white text-[10px] px-1.5 py-1 rounded border border-slate-600 focus:border-yellow-500 outline-none" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 w-20 shrink-0">Висота H:</span>
                            <input type="number" min={1} max={10} value={settingsForm.h}
                              onChange={e => setSettingsForm(f => ({ ...f, h: parseInt(e.target.value) || 1 }))}
                              className="flex-1 bg-slate-800 text-white text-[10px] px-1.5 py-1 rounded border border-slate-600 focus:border-yellow-500 outline-none" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 w-20 shrink-0">Карта img:</span>
                            <input type="text" value={settingsForm.mapImage || ''}
                              onChange={e => setSettingsForm(f => ({ ...f, mapImage: e.target.value }))}
                              placeholder={item.image || 'напр. Workbench.png'}
                              className="flex-1 bg-slate-800 text-white text-[10px] px-1.5 py-1 rounded border border-slate-600 focus:border-yellow-500 outline-none font-mono" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-2 items-center">
                              <label className="text-[10px] text-gray-300 w-1/3 leading-tight">Назва (крок 2):</label>
                              <input 
                                type="text" 
                                value={settingsForm.inventoryImage || ''}
                                onChange={e => setSettingsForm(f => ({ ...f, inventoryImage: e.target.value }))}
                                placeholder="назва для кліку"
                                className="flex-1 bg-slate-800 text-white text-[10px] px-1.5 py-1 rounded border border-slate-600 focus:border-yellow-500 outline-none font-mono" />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 w-20 shrink-0">Назва інв.:</span>
                            <input type="text" value={settingsForm.inventoryName || ''}
                              onChange={e => setSettingsForm(f => ({ ...f, inventoryName: e.target.value }))}
                              placeholder="як у farm.inventory"
                              className="flex-1 bg-slate-800 text-white text-[10px] px-1.5 py-1 rounded border border-slate-600 focus:border-yellow-500 outline-none" />
                          </div>
                        </div>
                        <div className="flex gap-1.5 mt-3">
                          <button onClick={() => setSettingsTypeName(null)} className="flex-1 text-[10px] py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors">Скасувати</button>
                          <button onClick={() => saveTypeSettings(settingsTypeName)} className="flex-1 text-[10px] py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded transition-colors">Зберегти</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {items.length} об'єктів • {placingBuilding ? <span className="text-yellow-400">Режим розміщення — клікни на карту</span> : 'Перетягуй будівлі для переміщення • ⚙️ на будівлі = налаштування типу'}
                </div>
              </div>
            )}
          </div>

          {/* Бокова панель */}
          <div className="w-64 border-l border-border/50 bg-[#131520] flex flex-col shrink-0 overflow-hidden">
            {/* Секція: Налаштування типів */}
            <div className="border-b border-border/30">
              <button
                onClick={() => setExpandedGroups(g => ({ ...g, _settings: !g['_settings'] }))}
                className="flex items-center justify-between w-full p-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                  <Puzzle size={14} className="text-blue-400" />
                  Типи ({uniqueItemTypes.length})
                </div>
                {expandedGroups['_settings'] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
              </button>
              {expandedGroups['_settings'] && (
                <div className="px-2 pb-2 max-h-48 overflow-y-auto space-y-0.5">
                  {uniqueItemTypes.map(name => {
                    const cfg = buildingTypes[name];
                    const hasConfig = cfg?.inventoryImage || cfg?.inventoryName;
                    return (
                      <button key={name}
                        onClick={e => openTypeSettings(name, e)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[11px] transition-colors ${settingsTypeName === name ? 'bg-yellow-500/20 text-yellow-300' : 'hover:bg-slate-700/60 text-slate-300'}`}
                      >
                        <span className="truncate">{name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasConfig ? <span className="text-green-400 text-[9px]">✓</span> : <span className="text-amber-500 text-[9px]">—</span>}
                          <Settings2 size={9} className="text-slate-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Секція: Інвентар */}
            {!loading && inventoryGroups.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => setShowInventory(!showInventory)}
                  className="flex items-center justify-between w-full p-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <Package size={14} className="text-yellow-400" />
                    Інвентар
                  </div>
                  {showInventory ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </button>
                {showInventory && (
                  <div className="p-2 space-y-3">
                    {inventoryGroups.map(group => (
                      <div key={group.category}>
                        {/* Заголовок категорії */}
                        <button
                          onClick={() => setExpandedGroups(g => ({ ...g, [group.category]: !g[group.category] }))}
                          className="flex items-center justify-between w-full mb-1 px-1"
                        >
                          <span className="text-[11px] font-bold text-slate-400">{CAT_LABEL[group.category]}</span>
                          {expandedGroups[group.category] ? <ChevronDown size={11} className="text-slate-500" /> : <ChevronRight size={11} className="text-slate-500" />}
                        </button>

                        {expandedGroups[group.category] && group.items.map(b => {
                          const available = b.count - b.placedCount;
                          const canPlace = available > 0;
                          const isPlacing = placingBuilding?.name === b.name;
                          const cfg = getTypeConfig(b.name);
                          const missingConfig = !cfg.inventoryImage;
                          return (
                            <button
                              key={b.name}
                              disabled={!canPlace}
                              onClick={() => setPlacingBuilding(isPlacing ? null : b)}
                              className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all mb-1 ${!canPlace ? 'opacity-50 cursor-not-allowed bg-slate-800/30 border-slate-700/30' : isPlacing ? 'bg-yellow-500/20 border-yellow-500/70' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600'}`}
                              title={!canPlace ? `${b.name}: всі розміщені на карті` : `${b.name}: ${available} доступно`}
                            >
                              <div className="w-8 h-8 shrink-0 rounded bg-black/40 flex items-center justify-center overflow-hidden relative">
                                {b.image && <img src={`/api/im/${b.image}`} alt={b.name} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                                {!canPlace && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-red-500 font-bold text-xs">X</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-white truncate">{b.name}</div>
                                <div className="text-[9px] text-slate-400">
                                  <span className={canPlace ? "text-green-400" : "text-slate-500"}>{b.count}</span> в інв. / <span className="text-slate-300">{b.placedCount}</span> на карті
                                </div>
                                {missingConfig && <div className="text-[8px] text-amber-400">⚠️ Немає інвент. img</div>}
                              </div>
                              {canPlace && <Plus size={12} className={`shrink-0 ${isPlacing ? 'text-yellow-400' : 'text-slate-500'}`} />}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    <div className="text-[9px] text-slate-500 text-center pt-1 pb-2">
                      Клікни → потім клікни на карту
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
