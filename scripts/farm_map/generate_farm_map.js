const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Конфігурація
const CELL_SIZE = 25;
const IMAGE_DIR = 'D:\\SF\\im';
const PROJECTS_DIR = 'D:\\SF\\backend\\projects';

// Мапінг типів об'єктів до розмірів та зображень
const OBJECT_TYPES = {
  crops: { size: [1, 1], image: 'Crop Plot.png' },
  trees: { size: [2, 2], image: 'Tree.png' },
  stones: { size: [1, 1], image: 'stone Rock.png' },
  iron: { size: [1, 1], image: 'iron Rock.png' },
  gold: { size: [1, 1], image: 'gold Rock.png' },
  crimstones: { size: [2, 2], image: 'Crimstone Rock.png' },
  fruitPatches: { size: [2, 2], image: 'fruit Patch.png' },
  flowerBeds: { size: [3, 1], image: 'Flower Bed.png' },
  beehives: { size: [1, 1], image: 'Beehive.png' },
  townCenter: { size: [4, 4], image: 'Town Center.png' },
  workbench: { size: [3, 2], image: 'Workbench.png' },
  market: { size: [3, 2], image: 'Market.png' },
  firePit: { size: [3, 2], image: 'Fire Pit.png' },
  house: { size: [4, 4], image: 'House.png' },
  compostBin: { size: [2, 2], image: 'Compost Bin.png' },
  kitchen: { size: [4, 4], image: 'Kitchen.png' },
  agingShed: { size: [3, 2], image: 'Aging Shed.png' },
  waterWell: { size: [2, 2], image: 'Water Well.png' },
  bigOrange: { size: [2, 2], image: 'Big Orange.png' },
  basicScarecrow: { size: [1, 1], image: 'Basic Scarecrow.png' }
};

// Мапінг українських ключів до типів об'єктів
const KEY_MAPPING_UK = {
  'культури': 'crops',
  'дерева': 'trees',
  'камені': 'stones',
  'залізо': 'iron',
  'золото': 'gold',
  'кримськіКамені': 'crimstones',
  'фруктовіПоля': 'fruitPatches',
  'квіти': 'flowers',
  'вулики': 'beehives',
  'будівлі': 'buildings',
  'колекційніПредмети': 'collectibles'
};

// Мапінг англійських ключів до типів об'єктів
const KEY_MAPPING_EN = {
  'crops': 'crops',
  'trees': 'trees',
  'stones': 'stones',
  'iron': 'iron',
  'gold': 'gold',
  'crimstones': 'crimstones',
  'fruitPatches': 'fruitPatches',
  'flowers': 'flowers',
  'beehives': 'beehives',
  'buildings': 'buildings',
  'collectibles': 'collectibles'
};

// Мапінг підтипів будівель до типів об'єктів
const BUILDING_SUBTYPE_MAPPING = {
  'Town Center': 'townCenter',
  'Workbench': 'workbench',
  'Market': 'market',
  'Fire Pit': 'firePit',
  'House': 'house',
  'Compost Bin': 'compostBin',
  'Kitchen': 'kitchen',
  'Aging Shed': 'agingShed',
  'Water Well': 'waterWell'
};

// Мапінг підтипів колекційних предметів до типів об'єктів
const COLLECTIBLE_SUBTYPE_MAPPING = {
  'Big Orange': 'bigOrange',
  'Basic Scarecrow': 'basicScarecrow'
};

/**
 * Читання JSON файлу проекту
 */
function readProjectSave(projectName) {
  const filePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Файл не знайдено: ${filePath}`);
    return null;
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

/**
 * Отримання всіх об'єктів з JSON
 */
function getObjectsFromState(state) {
  const objects = [];
  
  // Підтримка як українських, так і англійських ключів
  const farmState = state.відвіданийСтанФерми || state.visitedFarmState;
  
  if (!farmState) {
    return objects;
  }
  
  // Визначення, який мапінг використовувати
  const keyMapping = state.відвіданийСтанФерми ? KEY_MAPPING_UK : KEY_MAPPING_EN;
  const flowerKey = state.відвіданийСтанФерми ? 'квітковіЛіжка' : 'flowerBeds';
  
  // Обробка кожного типу об'єктів
  for (const [key, type] of Object.entries(keyMapping)) {
    const data = farmState[key];
    
    if (!data) continue;
    
    // Спеціальна обробка для квітів
    if (key === 'flowers' || key === 'квіти') {
      if (data[flowerKey]) {
        processObjectData(data[flowerKey], 'flowerBeds', objects);
      }
    } else if (key === 'buildings' || key === 'будівлі') {
      // Обробка будівель з підтипами
      processBuildingData(data, objects);
    } else if (key === 'collectibles' || key === 'колекційніПредмети') {
      // Обробка колекційних предметів з підтипами
      processCollectibleData(data, objects);
    } else {
      processObjectData(data, type, objects);
    }
  }
  
  return objects;
}

/**
 * Обробка даних будівель
 */
function processBuildingData(data, objects) {
  if (!data || typeof data !== 'object') return;
  
  for (const [buildingType, buildingData] of Object.entries(data)) {
    if (!buildingData) continue;
    
    const objectType = BUILDING_SUBTYPE_MAPPING[buildingType];
    if (!objectType) continue;
    
    // Будівлі можуть бути масивом або об'єктом
    if (Array.isArray(buildingData)) {
      // Обробка масиву будівель
      for (const building of buildingData) {
        if (!building || !building.coordinates) continue;
        
        const x = building.coordinates.x;
        const y = building.coordinates.y;
        
        if (x === undefined || y === undefined) continue;
        
        objects.push({
          id: building.id,
          x,
          y,
          type: objectType
        });
      }
    } else if (typeof buildingData === 'object') {
      // Обробка об'єкта будівель
      processObjectData(buildingData, objectType, objects);
    }
  }
}

/**
 * Обробка даних колекційних предметів
 */
function processCollectibleData(data, objects) {
  if (!data || typeof data !== 'object') return;
  
  for (const [collectibleType, collectibleData] of Object.entries(data)) {
    if (!collectibleData) continue;
    
    const objectType = COLLECTIBLE_SUBTYPE_MAPPING[collectibleType];
    if (!objectType) continue;
    
    // Колекційні предмети можуть бути масивом або об'єктом
    if (Array.isArray(collectibleData)) {
      // Обробка масиву колекційних предметів
      for (const collectible of collectibleData) {
        if (!collectible || !collectible.coordinates) continue;
        
        const x = collectible.coordinates.x;
        const y = collectible.coordinates.y;
        
        if (x === undefined || y === undefined) continue;
        
        objects.push({
          id: collectible.id,
          x,
          y,
          type: objectType
        });
      }
    } else if (typeof collectibleData === 'object') {
      // Обробка об'єкта колекційних предметів
      processObjectData(collectibleData, objectType, objects);
    }
  }
}

/**
 * Обробка даних об'єктів
 */
function processObjectData(data, objectType, objects) {
  if (!data || typeof data !== 'object') return;
  
  for (const [id, obj] of Object.entries(data)) {
    // Підтримка як українських (х, у), так і англійських (x, y) ключів
    const x = obj.х !== undefined ? obj.х : obj.x;
    const y = obj.у !== undefined ? obj.у : obj.y;
    
    if (!obj || x === undefined || y === undefined) continue;
    
    const objectData = {
      id,
      x,
      y,
      type: objectType
    };
    
    // Для crops зберігаємо інформацію про рослину
    if (objectType === 'crops' && obj.crop && obj.crop.name) {
      objectData.cropName = obj.crop.name;
    }
    
    objects.push(objectData);
  }
}

/**
 * Обчислення розмірів карти
 */
function calculateMapBounds(objects) {
  if (objects.length === 0) {
    return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
  }
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const obj of objects) {
    const typeInfo = OBJECT_TYPES[obj.type];
    if (!typeInfo) continue;
    
    const [width, height] = typeInfo.size;
    
    minX = Math.min(minX, obj.x);
    maxX = Math.max(maxX, obj.x + width);
    minY = Math.min(minY, obj.y);
    maxY = Math.max(maxY, obj.y + height);
  }
  
  // Додати відступ по 3 клітинки з кожного боку
  const padding = 3;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding
  };
}

/**
 * Отримання назви фону на основі типу острова та кількості Basic Land
 */
function getBackgroundName(farmState) {
  if (!farmState) return null;
  
  const islandType = farmState.island?.type || 'spring';
  const basicLand = farmState.inventory?.['Basic Land'] || farmState.inventory?.['Базова земля'] || '0';
  
  // Формуємо назву: islandType + basicLand (наприклад, spring7, basic9)
  const backgroundName = `${islandType}${basicLand}`;
  console.log(`Назва фону: ${backgroundName} (island.type=${islandType}, Basic Land=${basicLand})`);
  
  return backgroundName;
}

/**
 * Створення карти
 */
async function createFarmMap(objects, bounds, farmState) {
  // Завантаження фону для отримання розмірів
  const backgroundName = getBackgroundName(farmState);
  let canvasWidth = 524; // Дефолтний розмір
  let canvasHeight = 524;
  let bgImg = null;
  
  if (backgroundName) {
    const backgroundPath = path.join(IMAGE_DIR, `${backgroundName}.png`);
    try {
      bgImg = await loadImage(backgroundPath);
      canvasWidth = bgImg.width;
      canvasHeight = bgImg.height;
      console.log(`Фон завантажено: ${backgroundPath}, розмір: ${canvasWidth}x${canvasHeight}`);
    } catch (bgErr) {
      console.warn(`Зображення фону не знайдено: ${backgroundPath}, використовуємо дефолтний розмір 524x524`);
    }
  } else {
    console.log('Назва фону не визначена, використовуємо дефолтний розмір 524x524');
  }
  
  // Розмір канвасу відповідає розміру фону
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // Прозорий фон
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Накладання фону
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight);
  }
  
  // Накладання об'єктів
  for (const obj of objects) {
    const typeInfo = OBJECT_TYPES[obj.type];
    if (!typeInfo) continue;
    
    const [gridWidth, gridHeight] = typeInfo.size;
    const imagePath = path.join(IMAGE_DIR, typeInfo.image);
    
    try {
      const img = await loadImage(imagePath);
      
      // Розрахунок позиції в пікселях з центром на (249, 249)
      // x: 249 + obj.x * CELL_SIZE
      // y: 249 - obj.y * CELL_SIZE (інвертована вісь Y)
      const pixelX = 249 + obj.x * CELL_SIZE;
      const pixelY = 249 - obj.y * CELL_SIZE;
      const pixelWidth = gridWidth * CELL_SIZE;
      const pixelHeight = gridHeight * CELL_SIZE;
      
      // Накладання зображення
      ctx.drawImage(img, pixelX, pixelY, pixelWidth, pixelHeight);
      
      // Якщо це crop і є рослина, накладаємо зображення рослини
      if (obj.type === 'crops' && obj.cropName) {
        const cropImagePath = path.join(IMAGE_DIR, `${obj.cropName}.png`);
        try {
          const cropImg = await loadImage(cropImagePath);
          // Накладаємо рослину поверх crop plot
          ctx.drawImage(cropImg, pixelX, pixelY, pixelWidth, pixelHeight);
        } catch (cropErr) {
          // Якщо зображення рослини не знайдено, ігноруємо помилку
          console.warn(`Зображення рослини не знайдено: ${cropImagePath}`);
        }
      }
    } catch (err) {
      console.error(`Помилка завантаження зображення ${imagePath}:`, err.message);
    }
  }
  
  return canvas;
}

/**
 * Збереження карти
 */
function saveFarmMap(canvas, projectName) {
  const screenshotsDir = path.join(PROJECTS_DIR, `${projectName}_screenshots`);
  
  // Створення директорії, якщо не існує
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const outputPath = path.join(screenshotsDir, 'farm_map.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`Карта збережена: ${outputPath}`);
}

/**
 * Головна функція
 */
async function generateFarmMap(projectName) {
  console.log(`Генерація карти для проекту: ${projectName}`);
  
  // Читання JSON
  const projectData = readProjectSave(projectName);
  if (!projectData) {
    console.error('Не вдалося прочитати дані проекту');
    return;
  }
  
  // Отримання стану ферми для фону
  const farmState = projectData.відвіданийСтанФерми || projectData.visitedFarmState;
  
  // Отримання об'єктів
  const objects = getObjectsFromState(projectData);
  console.log(`Знайдено об\'єктів: ${objects.length}`);
  
  if (objects.length === 0) {
    console.log('Немає об\'єктів для відображення');
    return;
  }
  
  // Обчислення меж карти (не використовується для фіксованого розміру, але залишається для логування)
  const bounds = calculateMapBounds(objects);
  console.log(`Межі карти: X[${bounds.minX}, ${bounds.maxX}], Y[${bounds.minY}, ${bounds.maxY}]`);
  
  // Створення карти з фоном
  const canvas = await createFarmMap(objects, bounds, farmState);
  
  // Збереження
  saveFarmMap(canvas, projectName);
}

// Запуск з аргументом командного рядка
const projectName = process.argv[2];
if (!projectName) {
  console.error('Вкажіть назву проекту: node generate_farm_map.js <project_name>');
  console.error('Приклад: node generate_farm_map.js SF');
  process.exit(1);
}

generateFarmMap(projectName).catch(err => {
  console.error('Помилка:', err);
  process.exit(1);
});
