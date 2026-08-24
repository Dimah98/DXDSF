import React, { useState, useEffect, useCallback } from 'react';
import { 
  CalendarClock, 
  Clock, 
  FileJson, 
  Play, 
  Settings2, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  HelpCircle,
  Timer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface Config {
  id: string;
  name: string;
}

interface ProjectTimePreview {
  projectName: string;
  rawVal: unknown;
  timestamp: number | null;
  timeStr: string | null;
  dateStr: string | null;
  fullDateTime: string | null;
  relative: string | null;
  isPast: boolean;
  status: 'future' | 'due' | 'not_found' | 'invalid';
}

interface PreviewSummary {
  nextProject: string;
  nextTime: string;
  nextDateTime: string;
  nextRelative: string;
  isPast: boolean;
  totalWithTime: number;
  totalProjects: number;
}

interface MassLaunch {
  id: string;
  name: string;
  mode: 'manual_time' | 'json_time';
  time?: string;
  jsonPath?: string;
  configId?: string;
  containers: string[];
  enabled: boolean;
  calculatedTimes?: Array<{
    project: string;
    timestamp: number;
    timeStr: string;
    fullDateTime: string;
    relative: string;
    isPast: boolean;
  }>;
  nextLaunchSummary?: {
    time: string;
    fullDateTime: string;
    project: string;
    relative: string;
    isPast: boolean;
    totalWithTime: number;
    totalProjects: number;
  } | null;
}

const COMMON_JSON_PATHS = [
  { label: '🏝️ Острів (початок)', path: '$.visitedFarmState.floatingIsland.schedule[0].startAt' },
  { label: '🏝️ Острів (кінець)', path: '$.visitedFarmState.floatingIsland.schedule[0].endAt' },
  { label: '🚢 Поповнення корабля', path: '$.visitedFarmState.shipments.restockedAt' },
  { label: '⛏️ Шахта (mine-whack)', path: '$.visitedFarmState.minigames.games["mine-whack"].history[0].prizeClaimedAt' },
];

const MassSchedulerPage: React.FC<{currentView: any, setCurrentView: any}> = ({setCurrentView}) => {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [launches, setLaunches] = useState<MassLaunch[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [mode, setMode] = useState<'manual_time' | 'json_time'>('manual_time');
  const [time, setTime] = useState<string>('');
  const [jsonPath, setJsonPath] = useState<string>('$.visitedFarmState.floatingIsland.schedule[0].startAt');
  const [containersInput, setContainersInput] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [matchingProjects, setMatchingProjects] = useState<string[]>([]);
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Preview Time State
  const [previewTimes, setPreviewTimes] = useState<ProjectTimePreview[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showProjectsBreakdown, setShowProjectsBreakdown] = useState(false);
  const [expandedLaunchId, setExpandedLaunchId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects/SF/containers')
      .then(res => res.json())
      .then(data => { if (data.success) setAvailableContainers(data.containers); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isAdding) {
      setLoadingProjects(true);
      const cId = selectedConfigId || 'all';
      fetch('/api/configs/' + cId + '/matching-projects')
        .then(res => res.json())
        .then(data => {
          if (data.success) setMatchingProjects(data.projects);
          setLoadingProjects(false);
        })
        .catch(() => setLoadingProjects(false));
    }
  }, [selectedConfigId, isAdding]);

  // Live preview calculation when mode === 'json_time'
  const fetchTimePreview = useCallback(async (pathVal: string, cfgId: string) => {
    if (!pathVal.trim()) {
      setPreviewTimes([]);
      setPreviewSummary(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const q = new URLSearchParams({
        configId: cfgId || 'all',
        jsonPath: pathVal.trim()
      });
      const res = await fetch(`/api/mass-launches/preview-time?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPreviewTimes(data.projectTimes || []);
        setPreviewSummary(data.summary || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (isAdding && mode === 'json_time') {
      const timer = setTimeout(() => {
        fetchTimePreview(jsonPath, selectedConfigId);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAdding, mode, jsonPath, selectedConfigId, fetchTimePreview]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const cRes = await fetch('/api/configs');
      const cData = await cRes.json();
      if (cData.success && Array.isArray(cData.configs)) setConfigs(cData.configs);

      const lRes = await fetch('/api/mass-launches');
      const lData = await lRes.json();
      if (Array.isArray(lData)) setLaunches(lData);
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setName('');
    setSelectedConfigId('');
    setMode('manual_time');
    setTime('');
    setJsonPath('$.visitedFarmState.floatingIsland.schedule[0].startAt');
    setContainersInput('');
    setIsAdding(false);
    setEditingId(null);
    setStatus('');
    setPreviewTimes([]);
    setPreviewSummary(null);
    setShowProjectsBreakdown(false);
  };

  const handleEdit = (launch: MassLaunch) => {
    setEditingId(launch.id);
    setName(launch.name);
    setSelectedConfigId(launch.configId || '');
    setMode(launch.mode);
    setTime(launch.time || '');
    setJsonPath(launch.jsonPath || '$.visitedFarmState.floatingIsland.schedule[0].startAt');
    setContainersInput(launch.containers ? launch.containers.join(', ') : '');
    setIsAdding(true);
    setStatus('');
  };

  const handleSave = async () => {
    setStatus('Збереження...');
    try {
      const payload = {
        name: name || 'Новий запуск',
        mode,
        time: mode === 'manual_time' ? time : undefined,
        jsonPath: mode === 'json_time' ? jsonPath : undefined,
        configId: selectedConfigId || undefined,
        containers: containersInput.split(',').map(s => s.trim()).filter(s => s.length > 0),
        enabled: true
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/mass-launches/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/mass-launches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      
      if (data.error) {
        setStatus(`Помилка: ${data.error}`);
      } else {
        setStatus('Збережено!');
        resetForm();
        fetchData();
      }
    } catch (e) {
      setStatus(`Помилка: ${String(e)}`);
    }
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/mass-launches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteLaunch = async (id: string) => {
    if (!confirm('Видалити цей розклад?')) return;
    try {
      await fetch(`/api/mass-launches/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="w-full h-full bg-background overflow-y-auto p-8 custom-scrollbar relative flex flex-col text-white">
      <button onClick={() => setCurrentView('editor')} className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-lg border border-slate-700">
        <ArrowLeft size={18} />
        До Редактора
      </button>

      <div className="max-w-4xl mx-auto w-full space-y-6 mt-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CalendarClock size={32} className="text-blue-500" />
          Масовий Планувальник Задач
        </h1>
        <p className="text-slate-400">Цей інструмент дозволяє масово запланувати виконання специфічних контейнерів на різних проектах щоденно у вказаний час, або динамічно на основі міток часу з файлів збереження (_save.json).</p>
        
        {!isAdding ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Ваші заплановані запуски</h2>
              <Button onClick={() => { resetForm(); setIsAdding(true); }} className="bg-blue-600 hover:bg-blue-500">
                <Plus size={18} className="mr-2" /> Додати
              </Button>
            </div>

            {launches.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
                Немає запланованих масових запусків. Натисніть "Додати".
              </div>
            ) : (
              <div className="grid gap-4">
                {launches.map(launch => {
                  const isExpanded = expandedLaunchId === launch.id;
                  return (
                    <div key={launch.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3 shadow-lg transition-all hover:border-slate-700">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1.5 flex-1">
                          <div className="font-bold text-lg flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${launch.enabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></span>
                            {launch.name}
                          </div>

                          {/* Інформація про режим та годину запуску */}
                          {launch.mode === 'manual_time' ? (
                            <div className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                              <Clock size={16} />
                              Щоденно о <strong>{launch.time || '--:--'}</strong>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono bg-slate-950/60 px-2 py-1 rounded w-fit border border-slate-800">
                                <FileJson size={14} className="text-blue-400" />
                                {launch.jsonPath}
                              </div>

                              {launch.nextLaunchSummary ? (
                                <div className="text-sm text-green-400 flex flex-wrap items-center gap-2 pt-0.5">
                                  <span className="flex items-center gap-1 font-semibold bg-green-950/50 border border-green-800/60 px-2.5 py-0.5 rounded-full text-green-300">
                                    <Timer size={14} />
                                    Година запуску: {launch.nextLaunchSummary.time} ({launch.nextLaunchSummary.fullDateTime})
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    ({launch.nextLaunchSummary.relative}) • Проект: <span className="text-blue-300 font-semibold">{launch.nextLaunchSummary.project}</span>
                                  </span>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <AlertCircle size={14} />
                                  Час запуску з _save.json ще не розраховано або мітка відсутня
                                </div>
                              )}
                            </div>
                          )}

                          <div className="text-sm text-slate-400 flex items-center gap-1.5">
                            <Layers size={15} className="text-slate-500" />
                            Контейнери: <span className="text-slate-300">{launch.containers && launch.containers.length > 0 ? launch.containers.join(', ') : 'Усі (Start Node)'}</span>
                          </div>

                          {launch.configId && (
                            <div className="text-xs text-purple-400 flex items-center gap-1">
                              <Settings2 size={13} />
                              Фільтр: <span className="text-purple-300 font-medium">{configs.find(c => c.id === launch.configId)?.name || launch.configId}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {launch.mode === 'json_time' && launch.calculatedTimes && launch.calculatedTimes.length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs text-slate-400 hover:text-white"
                              onClick={() => setExpandedLaunchId(isExpanded ? null : launch.id)}
                            >
                              {isExpanded ? <ChevronUp size={16} className="mr-1" /> : <ChevronDown size={16} className="mr-1" />}
                              {isExpanded ? 'Сховати проекти' : `Всі години (${launch.calculatedTimes.length})`}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="bg-transparent border-slate-700 text-xs" onClick={() => handleEdit(launch)}>
                            <Edit size={14} className="mr-1" /> Редагувати
                          </Button>
                          <Button variant="outline" size="sm" className={`border-slate-700 text-xs ${launch.enabled ? 'text-amber-300 hover:text-amber-200' : 'text-green-400 hover:text-green-300'}`} onClick={() => toggleEnabled(launch.id, !launch.enabled)}>
                            {launch.enabled ? 'Вимкнути' : 'Увімкнути'}
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-900/30" onClick={() => deleteLaunch(launch.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>

                      {/* Розгорнутий список годин по всіх проектах */}
                      {isExpanded && launch.calculatedTimes && (
                        <div className="mt-2 pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Clock size={13} className="text-blue-400" />
                            Розраховані години запусків для кожного проекту:
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {launch.calculatedTimes.map(ct => (
                              <div key={ct.project} className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                                <span className="font-semibold text-blue-300">{ct.project}</span>
                                <div className="text-right">
                                  <span className="font-mono text-amber-300 font-bold">{ct.timeStr}</span>
                                  <span className="text-[10px] text-slate-500 block">{ct.relative}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Редагування розкладу' : 'Створення розкладу'}
              </h2>
              <Button variant="ghost" size="icon" onClick={resetForm}><X size={20} /></Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Назва розкладу</label>
              <Input placeholder="Наприклад: Збір врожаю на острові" value={name} onChange={e => setName(e.target.value)} className="bg-slate-950 border-slate-800" />
            </div>

            {/* Фільтр конфігурації */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings2 size={20} className="text-purple-400" />
                Конфігурація-фільтр
              </h3>
              <select
                value={selectedConfigId}
                onChange={e => setSelectedConfigId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Без фільтрації (Запускати всі) --</option>
                {configs.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              
              <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <h4 className="text-sm text-slate-400 mb-2">Відповідні проекти ({loadingProjects ? '...' : matchingProjects.length}):</h4>
                {loadingProjects ? (
                   <span className="text-xs text-slate-500">Завантаження...</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {matchingProjects.length > 0 ? matchingProjects.map(p => (
                      <span key={p} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs border border-slate-700">{p}</span>
                    )) : (
                      <span className="text-xs text-slate-500">Немає проектів, що відповідають цій конфігурації.</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Час запуску */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock size={20} className="text-yellow-400" />
                Час запуску
              </h3>
              <div className="flex gap-4">
                <Button 
                  variant={mode === 'manual_time' ? 'default' : 'outline'} 
                  onClick={() => setMode('manual_time')}
                  className={mode === 'manual_time' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}
                >
                  Вказати час (Щоденно)
                </Button>
                <Button 
                  variant={mode === 'json_time' ? 'default' : 'outline'} 
                  onClick={() => setMode('json_time')}
                  className={mode === 'json_time' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}
                >
                  Час із _save.json
                </Button>
              </div>

              {mode === 'manual_time' ? (
                <div className="space-y-2 mt-4">
                  <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Час початку</label>
                  <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-950 border-slate-800 w-48 text-xl p-4 h-auto" />
                  <p className="text-xs text-slate-500">Вкажіть тільки час. Розклад буде повторюватись щоденно у вказану годину.</p>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
                      <span>Шлях до Timestamp (json path)</span>
                      <span className="text-[11px] text-blue-400 font-normal lowercase">значення з visitedFarmState</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <FileJson size={18} className="text-slate-500 shrink-0" />
                      <Input 
                        placeholder="Наприклад: $.visitedFarmState.floatingIsland.schedule[0].startAt" 
                        value={jsonPath} 
                        onChange={e => setJsonPath(e.target.value)} 
                        className="bg-slate-950 border-slate-800 font-mono text-sm" 
                      />
                    </div>
                  </div>

                  {/* Швидкі шаблони */}
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Sparkles size={13} className="text-yellow-400" />
                      Швидкий вибір популярних міток часу Sunflower Land:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_JSON_PATHS.map(preset => (
                        <button
                          key={preset.path}
                          type="button"
                          onClick={() => setJsonPath(preset.path)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            jsonPath === preset.path 
                              ? 'bg-blue-600/30 text-blue-300 border-blue-500' 
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Живий попередній перегляд години запуску */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 shadow-inner">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <Clock size={16} className="text-amber-400" />
                        Розрахований час запуску за цією міткою:
                      </h4>
                      {loadingPreview && <span className="text-xs text-blue-400 animate-pulse">Розрахунок...</span>}
                    </div>

                    {previewSummary ? (
                      <div className="space-y-3">
                        {/* Головна картка найближчого запуску */}
                        <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-blue-950/40 border border-amber-500/30 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="text-xs text-amber-400/90 font-medium">⏰ Найближчий розрахований запуск:</div>
                            <div className="text-2xl font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                              <span>{previewSummary.nextTime}</span>
                              <span className="text-xs font-sans font-normal px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/40">
                                {previewSummary.nextRelative}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              Дата: <strong className="text-slate-300">{previewSummary.nextDateTime}</strong> • Проект: <strong className="text-blue-400">{previewSummary.nextProject}</strong>
                            </div>
                          </div>

                          <div className="text-xs text-right text-slate-400 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800 shrink-0">
                            <div>Мітку знайдено: <strong className="text-green-400">{previewSummary.totalWithTime}</strong> з <strong className="text-slate-200">{previewSummary.totalProjects}</strong> проектів</div>
                          </div>
                        </div>

                        {/* Кнопка розкриття списку по кожному проекту */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowProjectsBreakdown(!showProjectsBreakdown)}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                          >
                            {showProjectsBreakdown ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            {showProjectsBreakdown ? 'Сховати деталізацію по проектах' : `Показати години запуску по кожному проекту (${previewTimes.length})`}
                          </button>

                          {showProjectsBreakdown && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                              {previewTimes.map(pt => {
                                const hasTime = pt.status === 'future' || pt.status === 'due';
                                return (
                                  <div 
                                    key={pt.projectName} 
                                    className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                                      pt.status === 'future' 
                                        ? 'bg-slate-900/90 border-slate-700/80 text-slate-200' 
                                        : pt.status === 'due' 
                                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' 
                                        : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                                    }`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="font-bold flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${hasTime ? (pt.isPast ? 'bg-amber-400' : 'bg-green-400') : 'bg-slate-600'}`}></span>
                                        {pt.projectName}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {hasTime ? pt.dateStr : 'Мітка відсутня'}
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <div className="font-mono font-bold text-sm text-amber-300">
                                        {hasTime ? pt.timeStr : '--:--'}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {pt.relative || 'не знайдено'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                        <HelpCircle size={15} className="text-slate-400 shrink-0" />
                        <span>За вказаним шляхом міток часу не виявлено або файли збереження ще не завантажені. Введіть коректний json path.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-800" />

            {/* Контейнери */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Play size={20} className="text-green-400" />
                Які контейнери запускати?
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableContainers.map(container => {
                  const selected = containersInput.split(',').map(s => s.trim()).includes(container);
                  return (
                    <button
                      key={container}
                      type="button"
                      onClick={() => {
                        let current = containersInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
                        if (selected) {
                          current = current.filter(c => c !== container);
                        } else {
                          current.push(container);
                        }
                        setContainersInput(current.join(', '));
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${selected ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                    >
                      {container}
                    </button>
                  );
                })}
              </div>
              <Input 
                placeholder="Або введіть вручну (через кому)" 
                value={containersInput} 
                onChange={e => setContainersInput(e.target.value)} 
                className="bg-slate-950 border-slate-800 mt-2" 
              />
            </div>

            {/* Status and Action */}
            <div className="pt-4 flex items-center justify-between">
              <div className="text-sm text-blue-400 font-semibold">{status}</div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={resetForm} className="text-slate-400">
                  Скасувати
                </Button>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white px-8">
                  <Save size={18} className="mr-2" /> {editingId ? 'Оновити розклад' : 'Зберегти розклад'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MassSchedulerPage;


