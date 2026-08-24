import { useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { stripFunctionsFromNodes } from '../utils/flowUtils';

export function useAutoSave(
  nodes: Node[],
  edges: Edge[],
  globalVariablesRef: React.MutableRefObject<Record<string, any>>,
  API_HOST: string
) {
  // Створюємо реф для зберігання ідентифікатора таймера (використовуємо ReturnType для кросплатформності)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        // Отримуємо назву поточного проекту з локального сховища браузера
        const currentProject = localStorage.getItem('sfl_current_project') || 'default';
        
        // Очищаємо ноди від колбеків перед збереженням
        const cleanNodes = stripFunctionsFromNodes(nodes);

        // Зчитуємо налаштування запуску для поточного проекту з localStorage
        const savedLaunch = localStorage.getItem(`sfl_launch_settings_${currentProject}`);
        // Парсимо налаштування запуску або використовуємо дефолтні
        const launchSettings = savedLaunch ? JSON.parse(savedLaunch) : { mode: 'single' };
        
        // Зчитуємо налаштування браузера для поточного проекту з localStorage
        const savedBrowser = localStorage.getItem(`sfl_browser_${currentProject}`); // Отримання налаштувань з локального сховища
        // Парсимо налаштування браузера або використовуємо дефолтні
        const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {}; // Парсинг налаштувань або пустий об'єкт
        
        // Зчитуємо глобальні налаштування для отримання photoDebug та disableImages
        const savedGlobal = localStorage.getItem('sfl_global_settings_v4'); // Зчитування глобального конфігу
        // Декодуємо глобальні налаштування або використовуємо порожній об'єкт
        const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {}; // Декодування налаштувань або пустий об'єкт

        // Об'єднуємо поточні налаштування браузера з глобальними прапорцями
        const updatedBrowserSettings = { // Оновлений об'єкт налаштувань браузера
          ...browserSettings, // Копіювання існуючих налаштувань браузера проекту
          photoDebug: globalSettings.photoDebug !== false, // Перенесення глобального прапорця фотодебагу
          disableImages: globalSettings.disableImages === true, // Перенесення глобального прапорця вимкнення зображень
          headless: globalSettings.headless === true // Перенесення глобального прапорця невидимого режиму браузера
        }; // Завершення об'єднання налаштувань

        // Відправляємо запит на збереження проекту на сервер
        await fetch(`${API_HOST}/api/save`, { // Виклик API для збереження на сервері
          method: 'POST', // Використання HTTP-методу POST
          headers: { 'Content-Type': 'application/json' }, // Встановлення JSON заголовку
          body: JSON.stringify({ // Перетворення тіла запиту у JSON-рядок
            name: currentProject, // Назва проекту, який зберігається
            isAutoSave: true, // Вказуємо бекенду, що це автозбереження
            data: { // Об'єкт з даними проекту
              nodes: cleanNodes, // Масив очищених нод сценарію
              edges, // Масив ребер сценарію
              variables: globalVariablesRef.current, // Актуальні глобальні змінні проекту
              launchSettings, // Налаштування запуску
              browserSettings: updatedBrowserSettings // Оновлені налаштування браузера з фотодебагом
            } // Завершення об'єкта даних проекту
          }), // Завершення тіла запиту
        }); // Завершення виклику fetch
      } catch (e) {
        console.error('AutoSave error:', e);
      }
    }, 2000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [nodes, edges, globalVariablesRef, API_HOST]);
}
