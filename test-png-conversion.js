/**
 * Тестовий скрипт для перевірки конвертації зображень в PNG
 * Читає існуючий SF_inventory.json та конвертує всі data URLs в PNG файли
 */

const fs = require('fs').promises;
const path = require('path');

async function testPngConversion() {
  console.log('🔍 Початок тестування конвертації PNG...\n');
  
  // Читаємо існуючий inventory файл
  const inventoryPath = path.join(__dirname, 'backend', 'projects', 'SF_inventory.json');
  console.log(`📂 Читання файлу: ${inventoryPath}`);
  
  try {
    const data = await fs.readFile(inventoryPath, 'utf-8');
    const inventory = JSON.parse(data);
    
    console.log(`✅ Файл прочитано. Знайдено ${inventory.data.length} елементів\n`);
    
    // Аналізуємо типи зображень
    let httpCount = 0;
    let dataUrlCount = 0;
    let localPathCount = 0;
    
    inventory.data.forEach((item, index) => {
      if (item.image.startsWith('http://') || item.image.startsWith('https://')) {
        httpCount++;
        console.log(`  [${index + 1}] HTTP URL: ${item.image.substring(0, 60)}...`);
      } else if (item.image.startsWith('data:image/')) {
        dataUrlCount++;
        const formatMatch = item.image.match(/data:image\/(\w+);/);
        const format = formatMatch ? formatMatch[1] : 'unknown';
        console.log(`  [${index + 1}] Data URL (${format}): ${item.image.substring(0, 50)}...`);
      } else if (item.image.startsWith('/api/images/')) {
        localPathCount++;
        console.log(`  [${index + 1}] Local PNG: ${item.image}`);
      }
    });
    
    console.log(`\n📊 Статистика:`);
    console.log(`   HTTP/HTTPS URLs: ${httpCount}`);
    console.log(`   Data URLs (base64): ${dataUrlCount}`);
    console.log(`   Local PNG paths: ${localPathCount}`);
    
    console.log(`\n⚠️ ПРОБЛЕМА ВИЯВЛЕНА:`);
    if (dataUrlCount > 0) {
      console.log(`   У файлі ${dataUrlCount} зображень все ще зберігаються як data URLs!`);
      console.log(`   Це означає, що бот НЕ запускався з новим кодом конвертації.`);
    }
    if (httpCount > 0) {
      console.log(`   У файлі ${httpCount} зображень зберігаються як HTTP URLs!`);
      console.log(`   Це означає, що бот НЕ конвертував ці зображення в PNG.`);
    }
    
    // Перевіряємо директорію з PNG файлами
    const imagesDir = path.join(__dirname, 'backend', 'images', 'SF');
    console.log(`\n📁 Перевірка директорії PNG: ${imagesDir}`);
    
    try {
      const files = await fs.readdir(imagesDir);
      console.log(`   Знайдено файлів: ${files.length}`);
      if (files.length === 0) {
        console.log(`   ❌ Директорія порожня - PNG файли не створювались!`);
      } else {
        console.log(`   ✅ Файли знайдено:`);
        files.forEach(file => console.log(`      - ${file}`));
      }
    } catch (err) {
      console.log(`   ❌ Помилка читання директорії: ${err.message}`);
    }
    
    console.log(`\n💡 РІШЕННЯ:`);
    console.log(`   1. Запустіть бота SF з InventoryScannerNode`);
    console.log(`   2. Бот автоматично створить PNG файли`);
    console.log(`   3. JSON буде оновлено з шляхами до PNG файлів`);
    console.log(`   4. Android додаток зможе завантажувати зображення\n`);
    
  } catch (err) {
    console.error(`❌ Помилка: ${err.message}`);
  }
}

testPngConversion().catch(console.error);
