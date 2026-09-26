import { useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { attachEdgeCallbacks } from '../utils/flowUtils';
import { useUIStore } from '../store/useUIStore';

const SHARED_PROJECT_NAME = '__shared__';

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
  sharedNodesMode?: boolean;
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
  addLog,
  sharedNodesMode = false
}: UseProjectManagerProps) {
  const [activeProjectName, setActiveProjectName] = useState('default');

  // Зберігаємо актуальну версію attachCallbacks у ref — щоб loadProject не залежав від неї
  const attachCallbacksRef = useRef(attachCallbacks);
  useEffect(() => { attachCallbacksRef.current = attachCallbacks; }, [attachCallbacks]);

  // Ref для актуального значення sharedNodesMode
  const sharedNodesModeRef = useRef(sharedNodesMode);
  useEffect(() => { sharedNodesModeRef.current = sharedNodesMode; }, [sharedNodesMode]);

  const saveProject = useCallback(async (name: string = 'default') => {
    try {
      setActiveProjectName(name);
      
      // Якщо режим спільних нод — зберігаємо ноди в __shared__ та синхронізуємо з усіма проектами
      if (sharedNodesModeRef.current) {
        addLog(`Збереження спільної схеми нод...`, 'info');
        
        const savedLaunch = localStorage.getItem(`sfl_launch_settings_${SHARED_PROJECT_NAME}`);
        const launchSettings = savedLaunch ? JSON.parse(savedLaunch) : { mode: 'single' };
        const savedBrowser = localStorage.getItem(`sfl_browser_${SHARED_PROJECT_NAME}`);
        const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
        const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
        const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
        const updatedBrowserSettings = {
          ...browserSettings,
          photoDebug: globalSettings.photoDebug !== false,
          disableImages: globalSettings.disableImages === true,
          headless: globalSettings.headless === true
        };

        // Зберігаємо ноди в __shared__
        await fetch(`${API_HOST}/api/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: SHARED_PROJECT_NAME,
            data: {
              nodes: nodesRef.current,
              edges: edgesRef.current,
              variables: globalVariablesRef.current,
              launchSettings,
              browserSettings: updatedBrowserSettings
            }
          }),
        });

        // Синхронізуємо з усіма проектами
        const syncRes = await fetch(`${API_HOST}/api/projects/sync-shared-nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const syncData = await syncRes.json();
        
        addLog(`Спільна схема збережена та синхронізована з ${syncData.updated || 0} проектами`, 'success');
        
        // Також зберігаємо settings поточного проекту (окремо від нод)
        const savedLaunchCurrent = localStorage.getItem(`sfl_launch_settings_${name}`);
        const launchSettingsCurrent = savedLaunchCurrent ? JSON.parse(savedLaunchCurrent) : { mode: 'single' };
        const savedBrowserCurrent = localStorage.getItem(`sfl_browser_${name}`);
        const browserSettingsCurrent = savedBrowserCurrent ? JSON.parse(savedBrowserCurrent) : {};
        await fetch(`${API_HOST}/api/projects/${encodeURIComponent(name)}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ launchSettings: launchSettingsCurrent, browserSettings: { ...browserSettingsCurrent, ...updatedBrowserSettings } })
        }).catch(() => {});
        
        // Зберігаємо логи поточного проекту
        useUIStore.getState().requestSaveLogs(name);
        window.dispatchEvent(new CustomEvent('sfl-save-logs', { detail: { projectName: name } }));
        return;
      }

      // Звичайний режим — зберігаємо в поточний проект
      addLog(`Збереження проекту "${name}"...`, 'info');
      const savedLaunch = localStorage.getItem(`sfl_launch_settings_${name}`);
      const launchSettings = savedLaunch ? JSON.parse(savedLaunch) : { mode: 'single' };
      const savedBrowser = localStorage.getItem(`sfl_browser_${name}`);
      const browserSettings = savedBrowser ? JSON.parse(savedBrowser) : {};
      const savedGlobal = localStorage.getItem('sfl_global_settings_v4');
      const globalSettings = savedGlobal ? JSON.parse(savedGlobal) : {};
      const updatedBrowserSettings = {
        ...browserSettings,
        photoDebug: globalSettings.photoDebug !== false,
        disableImages: globalSettings.disableImages === true,
        headless: globalSettings.headless === true
      };

      await fetch(`${API_HOST}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          data: {
            nodes: nodesRef.current,
            edges: edgesRef.current,
            variables: globalVariablesRef.current,
            launchSettings,
            browserSettings: updatedBrowserSettings
          }
        }),
      });
      
      useUIStore.getState().requestSaveLogs(name);
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
      
      // Якщо режим спільних нод — завантажуємо ноди з __shared__, а налаштування з поточного проекту
      if (sharedNodesModeRef.current) {
        // Завантажуємо налаштування поточного проекту (settings, variables)
        const res = await fetch(`${API_HOST}/api/load?name=${encodeURIComponent(name)}`);
        if (res.ok) {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            if (data.variables) setGlobalVariables(data.variables);
            if (data.launchSettings) localStorage.setItem(`sfl_launch_settings_${name}`, JSON.stringify(data.launchSettings));
            if (data.browserSettings) localStorage.setItem(`sfl_browser_${name}`, JSON.stringify(data.browserSettings));
          }
        }
        
        // Завантажуємо ноди з __shared__
        const sharedRes = await fetch(`${API_HOST}/api/load?name=${encodeURIComponent(SHARED_PROJECT_NAME)}`);
        if (!sharedRes.ok) {
          // Якщо __shared__ ще не існує — використовуємо ноди поточного проекту
          addLog(`Спільна схема ще не створена. Використовуються ноди проекту "${name}"`, 'info');
          const fallbackRes = await fetch(`${API_HOST}/api/load?name=${encodeURIComponent(name)}`);
          if (fallbackRes.ok) {
            const fallbackText = await fallbackRes.text();
            if (fallbackText) {
              const fallbackData = JSON.parse(fallbackText);
              setNodes(attachCallbacksRef.current(fallbackData.nodes || []));
              const rawEdges = (fallbackData.edges || []).map((edge: any) => ({
                ...edge, animated: false,
                style: { ...edge.style, strokeWidth: 1.5, opacity: 0.4 }
              }));
              setEdges(attachEdgeCallbacks(rawEdges, setEdges));
            }
          }
          addLog(`Проект "${name}" завантажено (звичайний режим)`, 'success');
          return;
        }
        
        const sharedText = await sharedRes.text();
        if (!sharedText) {
          addLog(`Спільна схема порожня`, 'info');
          return;
        }
        
        const sharedData = JSON.parse(sharedText);
        setNodes(attachCallbacksRef.current(sharedData.nodes || []));
        const rawEdges = (sharedData.edges || []).map((edge: any) => ({
          ...edge, animated: false,
          style: { ...edge.style, strokeWidth: 1.5, opacity: 0.4 }
        }));
        setEdges(attachEdgeCallbacks(rawEdges, setEdges));
        addLog(`Проект "${name}" + спільна схема нод завантажено`, 'success');
        return;
      }

      // Звичайний режим
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
      
      if (data.launchSettings) {
        localStorage.setItem(`sfl_launch_settings_${name}`, JSON.stringify(data.launchSettings));
      }
      
      if (data.browserSettings) {
        localStorage.setItem(`sfl_browser_${name}`, JSON.stringify(data.browserSettings));
      }

      setNodes(attachCallbacksRef.current(data.nodes || []));
      
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
