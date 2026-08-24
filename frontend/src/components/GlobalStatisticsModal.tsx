import React, { useEffect, useState, useMemo } from 'react';
import { X, Calendar, RefreshCcw, Filter, Globe } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GlobalStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectStatEntry {
  projectName: string;
  stats: {
    timestamp: number;
    snapshot?: Record<string, any>;
    changes?: Record<string, { old: any, new: any }>;
  }[];
}

export const GlobalStatisticsModal: React.FC<GlobalStatisticsModalProps> = ({ isOpen, onClose }) => {
  const [globalStats, setGlobalStats] = useState<ProjectStatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#14b8a6', '#6366f1'];

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/global-stats`);
      if (res.ok) {
        const data = await res.json();
        setGlobalStats(data || []);
      }
    } catch (e) {
      console.error('Failed to load global stats:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  // Збираємо список усіх унікальних числових змінних з усіх проектів
  const availableVars = useMemo(() => {
    const varsSet = new Set<string>();
    globalStats.forEach(project => {
      let currentSnapshot: Record<string, any> = {};
      project.stats.forEach(entry => {
        if (entry.snapshot) {
          currentSnapshot = { ...currentSnapshot, ...entry.snapshot };
        } else if (entry.changes) {
          Object.keys(entry.changes).forEach(key => {
             currentSnapshot[key] = entry.changes![key].new;
          });
        }
        Object.keys(currentSnapshot).forEach(key => {
          const val = currentSnapshot[key];
          if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')) {
            varsSet.add(key);
          }
        });
      });
    });
    return Array.from(varsSet).sort();
  }, [globalStats]);

  useEffect(() => {
    if (availableVars.length > 0 && !availableVars.includes(selectedVariable)) {
      setSelectedVariable(availableVars[0]);
    }
  }, [availableVars, selectedVariable]);

  // Підготовлюємо точки даних для вибраної змінної
  const { dataPoints, projectNames } = useMemo(() => {
    if (!selectedVariable) return { dataPoints: [], projectNames: [] };
    
    // Збираємо всі унікальні timestamp (округлені до хвилин для групування)
    const timeMap = new Map<number, any>();
    const projNames = new Set<string>();
    
    // Щоб графік не стрибав на 0, нам треба пам'ятати останнє відоме значення змінної для кожного проекту
    const lastKnownValue: Record<string, number> = {};

    // Збираємо всі події в один плоский масив і сортуємо за часом
    const allEvents: { time: number, proj: string, val: number }[] = [];

    globalStats.forEach(project => {
      let currentSnapshot: Record<string, any> = {};
      project.stats.forEach(entry => {
        if (entry.snapshot) {
          currentSnapshot = { ...currentSnapshot, ...entry.snapshot };
        } else if (entry.changes) {
          Object.keys(entry.changes).forEach(key => {
             currentSnapshot[key] = entry.changes![key].new;
          });
        }
        
        const val = currentSnapshot[selectedVariable];
        if (val !== undefined) {
          const numVal = Number(val);
          if (!isNaN(numVal)) {
            projNames.add(project.projectName);
            // Округлюємо час до найближчих 5 хвилин щоб точки з різних проектів могли злитися
            const roundedTime = Math.floor(entry.timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);
            allEvents.push({ time: roundedTime, proj: project.projectName, val: numVal });
          }
        }
      });
    });
    
    allEvents.sort((a, b) => a.time - b.time);
    
    allEvents.forEach(ev => {
      lastKnownValue[ev.proj] = ev.val;
      if (!timeMap.has(ev.time)) {
        timeMap.set(ev.time, { 
          timestamp: ev.time, 
          time: new Date(ev.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          ...lastKnownValue // Копіюємо останні відомі значення всіх проектів
        });
      } else {
        const point = timeMap.get(ev.time);
        point[ev.proj] = ev.val;
      }
    });

    const points = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    
    // Заповнюємо пропуски: кожна точка повинна мати значення для кожного проекту (останнє відоме)
    // Оскільки ми вже робили ...lastKnownValue, це частково вирішено, але пройдемось ще раз для певності
    let currentFill: Record<string, number> = {};
    points.forEach(p => {
       projNames.forEach(proj => {
          if (p[proj] !== undefined) {
             currentFill[proj] = p[proj];
          } else if (currentFill[proj] !== undefined) {
             p[proj] = currentFill[proj];
          }
       });
    });

    return { dataPoints: points, projectNames: Array.from(projNames) };
  }, [globalStats, selectedVariable]);

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
    <div className="fixed inset-0 z-[var(--z-modal-high)] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-5xl h-[85vh] flex flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)] border border-[var(--accent-purple)]/30 shadow-inner">
              <Globe size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[var(--accent-purple)] tracking-widest">Загальна Статистика</p>
              <h2 className="text-[14px] font-bold text-[var(--interface-text-primary)] mt-0.5">Всі проекти</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {availableVars.length > 0 && (
              <div className="flex items-center gap-3 bg-black/30 p-1.5 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 pl-2 border-r border-white/10 pr-3">
                  <Filter size={14} className="text-slate-400" />
                  <select
                    value={selectedVariable}
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer"
                  >
                    <optgroup label="Змінні">
                      {availableVars.map(v => (
                        <option key={v} value={v} className="bg-slate-800 text-slate-200">{v}</option>
                      ))}
                    </optgroup>
                  </select>
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
            <button onClick={onClose} className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors bg-[var(--button-danger-bg)]/10 hover:bg-[var(--button-danger-bg)]/30 text-[var(--button-danger-bg)]">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6 relative">
          {globalStats.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
              <Calendar size={48} className="opacity-20" />
              <p className="text-sm font-medium">Немає даних для відображення.</p>
              <p className="text-xs">Запустіть бота на проектах, щоб зібрати статистику змінних.</p>
            </div>
          ) : (
            <>
              {availableVars.length > 0 && selectedVariable ? (
                <div className="flex-1 min-h-0 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 ml-2">
                    Динаміка зміни: <span className="text-purple-400">{selectedVariable}</span> (по проектах)
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
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        
                        {projectNames.map((proj, i) => (
                          <Line 
                            key={proj}
                            type="monotone" 
                            dataKey={proj} 
                            name={proj}
                            stroke={colors[i % colors.length]} 
                            strokeWidth={2}
                            dot={{ r: 3, strokeWidth: 1 }}
                            activeDot={{ r: 5 }}
                            connectNulls={true}
                          />
                        ))}
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
