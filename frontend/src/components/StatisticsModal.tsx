import React, { useEffect, useState, useMemo } from 'react';
import { X, TrendingUp, Calendar, RefreshCcw, Filter, Settings, Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

interface StatEntry {
  timestamp: number;
  snapshot?: Record<string, any>;
  changes?: Record<string, { old: any, new: any }>;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({ isOpen, onClose, projectName }) => {
  const [stats, setStats] = useState<StatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  
  // Групи змінних
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupVars, setNewGroupVars] = useState<string[]>([]);
  
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

  const loadStats = async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stats/${encodeURIComponent(projectName)}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data || []);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
      if (projectName) {
         const saved = localStorage.getItem(`sfl_stats_groups_${projectName}`);
         if (saved) setGroups(JSON.parse(saved));
      }
    }
  }, [isOpen, projectName]);

  const saveGroups = (newGroups: Record<string, string[]>) => {
     setGroups(newGroups);
     localStorage.setItem(`sfl_stats_groups_${projectName}`, JSON.stringify(newGroups));
  };

  // Обробка даних: відновлюємо повні значення змінних у кожній точці часу
  const { dataPoints, availableVars } = useMemo(() => {
    let currentSnapshot: Record<string, any> = {};
    const points: any[] = [];
    const varsSet = new Set<string>();

    stats.forEach(entry => {
      // Оновлюємо поточний стан (підтримує і старий формат changes, і новий snapshot)
      if (entry.snapshot) {
        currentSnapshot = { ...currentSnapshot, ...entry.snapshot };
      } else if (entry.changes) {
        Object.keys(entry.changes).forEach(key => {
           currentSnapshot[key] = entry.changes![key].new;
        });
      }
      
      const point: any = {
        timestamp: entry.timestamp,
        time: new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };
      
      // Додаємо лише числові змінні до графіка
      Object.keys(currentSnapshot).forEach(key => {
        const val = currentSnapshot[key];
        if (typeof val === 'number') {
          varsSet.add(key);
          point[key] = val;
        } else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
          varsSet.add(key);
          point[key] = Number(val);
        }
      });
      points.push(point);
    });
    
    const varsArray = Array.from(varsSet).sort();
    return { dataPoints: points, availableVars: varsArray };
  }, [stats]);

  // Якщо змінна не вибрана або вибрана невалідна (не існує ні в змінних, ні в групах)
  useEffect(() => {
    if (availableVars.length > 0) {
      const isGroupSelected = selectedVariable.startsWith('group:');
      const groupName = selectedVariable.replace('group:', '');
      const groupExists = isGroupSelected && Object.keys(groups).includes(groupName);
      
      if (!selectedVariable || (!availableVars.includes(selectedVariable) && !groupExists)) {
        const groupKeys = Object.keys(groups);
        if (groupKeys.length > 0) {
           setSelectedVariable(`group:${groupKeys[0]}`);
        } else {
           setSelectedVariable(availableVars[0]);
        }
      }
    }
  }, [availableVars, selectedVariable, groups]);

  // Фільтрація за часом
  const filteredData = useMemo(() => {
    if (selectedPeriod === 'all') return dataPoints;
    const now = Date.now();
    let cutoff = now;
    if (selectedPeriod === '24h') cutoff = now - 24 * 60 * 60 * 1000;
    else if (selectedPeriod === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (selectedPeriod === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
    
    return dataPoints.filter(p => p.timestamp >= cutoff);
  }, [dataPoints, selectedPeriod]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-5xl h-[85vh] flex flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-inner">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Статистика проекту</p>
              <h2 className="text-[14px] font-bold text-slate-200 mt-0.5">{projectName}</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Фільтри (показуємо тільки якщо є дані) */}
            {availableVars.length > 0 && (
              <div className="flex items-center gap-3 bg-black/30 p-1.5 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 pl-2 border-r border-white/10 pr-3">
                  <Filter size={14} className="text-slate-400" />
                  <select
                    value={selectedVariable}
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer"
                  >
                    {Object.keys(groups).length > 0 && (
                      <optgroup label="Групи">
                        {Object.keys(groups).map(g => (
                          <option key={`group:${g}`} value={`group:${g}`} className="bg-slate-800 text-purple-300">
                            {g}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Змінні">
                      {availableVars.map(v => (
                        <option key={v} value={v} className="bg-slate-800 text-slate-200">{v}</option>
                      ))}
                    </optgroup>
                  </select>
                  <button 
                    onClick={() => setShowGroupManager(!showGroupManager)}
                    className={`p-1 rounded transition-colors ml-1 ${showGroupManager ? 'bg-purple-500/30 text-purple-400' : 'hover:bg-white/10 text-slate-500 hover:text-slate-300'}`}
                    title="Управління групами"
                  >
                    <Settings size={14} />
                  </button>
                </div>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="bg-transparent text-sm text-slate-300 outline-none pr-2 cursor-pointer"
                >
                  <option value="all" className="bg-slate-800">За весь час</option>
                  <option value="24h" className="bg-slate-800">Останні 24 години</option>
                  <option value="7d" className="bg-slate-800">Останні 7 днів</option>
                  <option value="30d" className="bg-slate-800">Останні 30 днів</option>
                </select>
              </div>
            )}
            
            <button onClick={loadStats} className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors" title="Оновити">
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors bg-red-500/10 hover:bg-red-500/30 text-red-400">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6 relative">
          
          {/* Менеджер груп */}
          {showGroupManager && (
            <div className="absolute top-6 left-6 right-6 z-10 bg-slate-900 border border-purple-500/30 rounded-xl p-4 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Групи змінних</h3>
                <button onClick={() => setShowGroupManager(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
              </div>
              
              <div className="flex gap-4">
                {/* Створення нової групи */}
                <div className="flex-1 flex flex-col gap-3 bg-white/5 p-3 rounded-lg border border-white/10">
                  <h4 className="text-xs font-bold text-slate-300">Створити групу</h4>
                  <input 
                    type="text" 
                    placeholder="Назва групи (напр. Рослини)" 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500"
                  />
                  <div className="flex-1 overflow-y-auto max-h-32 flex flex-wrap gap-2">
                    {availableVars.map(v => (
                      <label key={v} className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded cursor-pointer hover:bg-white/10">
                        <input 
                          type="checkbox" 
                          checked={newGroupVars.includes(v)}
                          onChange={e => {
                            if (e.target.checked) setNewGroupVars(prev => [...prev, v]);
                            else setNewGroupVars(prev => prev.filter(x => x !== v));
                          }}
                        />
                        <span className="text-xs text-slate-300">{v}</span>
                      </label>
                    ))}
                  </div>
                  <button 
                    disabled={!newGroupName.trim() || newGroupVars.length === 0}
                    onClick={() => {
                      saveGroups({ ...groups, [newGroupName.trim()]: newGroupVars });
                      setNewGroupName('');
                      setNewGroupVars([]);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Зберегти групу
                  </button>
                </div>
                
                {/* Список існуючих груп */}
                <div className="flex-1 bg-white/5 p-3 rounded-lg border border-white/10 flex flex-col gap-2 overflow-y-auto max-h-56">
                  <h4 className="text-xs font-bold text-slate-300 mb-1">Існуючі групи</h4>
                  {Object.keys(groups).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Груп ще немає</p>
                  ) : (
                    Object.entries(groups).map(([name, vars]) => (
                      <div key={name} className="flex flex-col bg-black/40 rounded border border-white/5 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-purple-300">{name}</span>
                          <button 
                            onClick={() => {
                              const newG = { ...groups };
                              delete newG[name];
                              saveGroups(newG);
                              if (selectedVariable === `group:${name}`) setSelectedVariable(availableVars[0]);
                            }}
                            className="text-red-500/70 hover:text-red-400 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">{vars.join(', ')}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {stats.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
              <Calendar size={48} className="opacity-20" />
              <p className="text-sm font-medium">Немає даних для відображення.</p>
              <p className="text-xs">Запустіть бота, щоб зібрати першу статистику змінних.</p>
            </div>
          ) : (
            <>
              {availableVars.length > 0 && selectedVariable ? (
                <div className="flex-1 min-h-0 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 ml-2">
                    Динаміка зміни: <span className="text-blue-400">{selectedVariable}</span>
                  </h3>
                  
                  {filteredData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={filteredData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} tickMargin={10} minTickGap={30} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        />
                        {selectedVariable.startsWith('group:') && groups[selectedVariable.replace('group:', '')] && (
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        )}
                        
                        {selectedVariable.startsWith('group:') && groups[selectedVariable.replace('group:', '')] ? (
                          groups[selectedVariable.replace('group:', '')].map((v, i) => (
                            <Line 
                              key={v}
                              type="monotone" 
                              dataKey={v} 
                              name={v}
                              stroke={colors[i % colors.length]} 
                              strokeWidth={2}
                              dot={{ r: 3, strokeWidth: 1 }}
                              activeDot={{ r: 5 }}
                              connectNulls={true}
                            />
                          ))
                        ) : (
                          <Line 
                            type="monotone" 
                            dataKey={selectedVariable} 
                            name={selectedVariable}
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: '#020617' }}
                            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                            connectNulls={true}
                            animationDuration={1000}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                      Немає даних за вибраний період
                    </div>
                  )}
                </div>
              ) : (
                 <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-sm">
                   Знайдено записи, але немає числових змінних для побудови графіка. Переконайтеся, що ваші змінні містять числа.
                 </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
