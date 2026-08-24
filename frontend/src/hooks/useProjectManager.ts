import { useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { attachEdgeCallbacks } from '../utils/flowUtils';

interface UseProjectManagerProps {
  API_HOST: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  attachCallbacks: (nodes: Node[]) => Node[];
  setGlobalVariables: (vars: any) => void;
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  globalVariablesRef: React.MutableRefObject<Record<string, any>>;
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: any) => void;
}

export function useProjectManager({
  API_HOST,
  setNodes,
  setEdges,
  attachCallbacks,
  setGlobalVariables,
  nodesRef,
  edgesRef,
  globalVariablesRef,
  addLog
}: UseProjectManagerProps) {
  const [activeProjectName, setActiveProjectName] = useState('default');

  // Зберігаємо актуальну версію attachCallbacks у ref — щоб loadProject не залежав від неї
  const attachCallbacksRef = useRef(attachCallbacks);
  useEffect(() => { attachCallbacksRef.current = attachCallbacks; }, [attachCallbacks]);

  const saveProject = useCallback(async (name: string = 'default') => {
    try {
      setActiveProjectName(name);
      addLog(`Збереження проекту "${name}"...`, 'info');
      const savedLaunch = localStorage.getItem(`sfl_launch_settings_${name}`);
      const launchSettings = savedLaunch ? JSON.parse(savedLaunch) : { mode: 'single' };
      const savedBrowser = localStorage.getItem(`sfl_browser_${name}`); // Зчитування збережених налаштувань браузера проекту
      const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {}; // Декодування налаштувань або пустий об'єкт

      // Зчитуємо глобальні налаштування для отримання photoDebug та disableImages
      const savedGlobal = localStorage.getItem('sfl_global_settings_v4'); // Отримання глобальних налаштувань
      // Декодуємо глобальні налаштування або використовуємо порожній об'єкт
      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {}; // Декодування налаштувань або пустий об'єкт

      // Об'єднуємо поточні налаштування браузера з глобальними прапорцями
      const updatedBrowserSettings = { // Оновлений об'єкт налаштувань браузера
        ...browserSettings, // Копіювання існуючих налаштувань браузера проекту
        photoDebug: globalSettings.photoDebug !== false, // Встановлення глобального прапорця фотодебагу
        disableImages: globalSettings.disableImages === true, // Встановлення глобального прапорця вимкнення зображень
        headless: globalSettings.headless === true // Встановлення глобального прапорця невидимого режиму браузера
      }; // Завершення об'єднання налаштувань

      await fetch(`${API_HOST}/api/save`, { // Відправлення запиту збереження на сервер
        method: 'POST', // Метод POST
        headers: { 'Content-Type': 'application/json' }, // Встановлення JSON заголовка
        body: JSON.stringify({ // Серіалізація об'єкта даних
          name, // Назва проекту для збереження
          data: { // Дані проекту
            nodes: nodesRef.current, // Поточні ноди проекту з референсу
            edges: edgesRef.current, // Поточні ребра проекту з референсу
            variables: globalVariablesRef.current, // Змінні проекту з референсу
            launchSettings, // Параметри запуску проекту
            browserSettings: updatedBrowserSettings // Оновлені налаштування браузера проекту
          } // Кінець об'єкта даних
        }), // Кінець тіла запиту
      }); // Кінець fetch запиту
      
      // Відправляємо подію для збереження поточних логів
      window.dispatchEvent(new CustomEvent('sfl-save-logs', { detail: { projectName: name } }));
      
      addLog(`Проект "${name}" успішно збережено`, 'success');
    } catch (e) {
      addLog(`Помилка збереження: ${e}`, 'error');
      console.error('Помилка збереження проекту:', e);
    }
  }, [API_HOST, nodesRef, edgesRef, globalVariablesRef, addLog]);

  const loadProject = useCallback(async (name: string = 'default') => {
    try {
      setActiveProjectName(name);
      addLog(`Завантаження проекту "${name}"...`, 'info');
      const res = await fetch(`${API_HOST}/api/load?name=${encodeURIComponent(name)}`);
      
      if (!res.ok) {
        throw new Error(`Сервер повернув помилку: ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      if (!text) {
        throw new Error('Отримано порожню відповідь від сервера');
      }

      const data = JSON.parse(text);
      
      if (data.variables) setGlobalVariables(data.variables);
      
      // Перевіряємо чи є налаштування запуску у завантажених даних проекту
      if (data.launchSettings) {
        // Зберігаємо налаштування запуску в localStorage для поточного проекту
        localStorage.setItem(`sfl_launch_settings_${name}`, JSON.stringify(data.launchSettings));
      }
      
      // Перевіряємо чи є налаштування браузера у завантажених даних проекту
      if (data.browserSettings) {
        // Зберігаємо налаштування браузера в localStorage для поточного проекту
        localStorage.setItem(`sfl_browser_${name}`, JSON.stringify(data.browserSettings));
      }

      // Використовуємо ref для attachCallbacks — стабільна залежність
      setNodes(attachCallbacksRef.current(data.nodes || []));
      
      // Відновлюємо стилі та колбеки ребер через уніфіковану утиліту
      const rawEdges = (data.edges || []).map((edge: any) => ({
        ...edge,
        animated: false,
        style: { ...edge.style, strokeWidth: 1.5, opacity: 0.4 }
      }));
      setEdges(attachEdgeCallbacks(rawEdges, setEdges));
      addLog(`Проект "${name}" завантажено`, 'success');
    } catch (e) {
      addLog(`Помилка завантаження: ${e}`, 'error');
      console.error('Помилка завантаження проекту:', e);
    }
  // attachCallbacks НЕ в залежностях — читаємо через ref, щоб уникнути нескінченного циклу
  }, [API_HOST, setNodes, setEdges, setGlobalVariables, addLog]);

  const onClear = useCallback(() => {
    if (window.confirm('Ви впевнені, що хочете очистити проект?')) {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  // Зберігаємо loadProject у ref для стабільного useEffect
  const loadProjectRef = useRef(loadProject);
  useEffect(() => { loadProjectRef.current = loadProject; }, [loadProject]);

  // Завантажуємо проект за замовчуванням ОДИН РАЗ при монтуванні
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const projectName = localStorage.getItem('sfl_current_project') || 'default';
        await loadProjectRef.current(projectName);
      } catch (e) {
        console.error('Initial load error:', e);
      }
    };
    loadInitial();
  // Порожній масив залежностей — виконується лише при монтуванні
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activeProjectName,
    saveProject,
    loadProject,
    onClear
  };
}
