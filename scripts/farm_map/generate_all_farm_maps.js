const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PROJECTS_DIR = 'D:\\SF\\backend\\projects';

/**
 * Отримання списку всіх проектів
 */
function getProjectList() {
  const files = fs.readdirSync(PROJECTS_DIR);
  const projects = [];
  
  for (const file of files) {
    // Шукаємо файли з закінченням _save.json
    if (file.endsWith('_save.json')) {
      const projectName = file.replace('_save.json', '');
      projects.push(projectName);
    }
  }
  
  return projects;
}

/**
 * Генерація карти для одного проекту
 */
function generateMapForProject(projectName) {
  return new Promise((resolve, reject) => {
    console.log(`\nГенерація карти для: ${projectName}`);
    
    exec(`node generate_farm_map.js ${projectName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Помилка для ${projectName}:`, error.message);
        resolve(false);
      } else {
        console.log(stdout);
        resolve(true);
      }
    });
  });
}

/**
 * Головна функція
 */
async function generateAllMaps() {
  console.log('Пошук проектів...');
  const projects = getProjectList();
  console.log(`Знайдено проектів: ${projects.length}`);
  
  if (projects.length === 0) {
    console.log('Проектів не знайдено');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const project of projects) {
    const success = await generateMapForProject(project);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n========================================');
  console.log(`Генерація завершена`);
  console.log(`Успішно: ${successCount}`);
  console.log(`Помилок: ${failCount}`);
  console.log('========================================');
}

generateAllMaps().catch(err => {
  console.error('Критична помилка:', err);
  process.exit(1);
});
