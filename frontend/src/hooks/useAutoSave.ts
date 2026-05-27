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
        const savedBrowser = localStorage.getItem(`sfl_browser_${currentProject}`);
        // Парсимо налаштування браузера або використовуємо дефолтні
        const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};

        // Відправляємо запит на збереження проекту на сервер
        await fetch(`${API_HOST}/api/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: currentProject,
            data: { 
              nodes: cleanNodes, 
              edges,
              variables: globalVariablesRef.current,
              launchSettings,
              browserSettings
            }
          }),
        });
      } catch (e) {
        console.error('AutoSave error:', e);
      }
    }, 2000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [nodes, edges, globalVariablesRef, API_HOST]);
}
