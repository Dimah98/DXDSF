import React, { useEffect, useState, useMemo } from 'react';
import { X, Calendar, RefreshCcw, Filter, Globe, Layers } from 'lucide-react';
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
  const [selectedGrouping, setSelectedGrouping] = useState<string>('auto');
  
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

  // Збираємо сирі події для вибраної змінної
  const { allEvents, projectNames } = useMemo(() => {
    if (!selectedVariable) return { allEvents: [], projectNames: [] };
    const events: { time: number; proj: string; val: number }[] = [];
    const projSet = new Set<string>();

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
            projSet.add(project.projectName);
            events.push({ time: entry.timestamp, proj: project.projectName, val: numVal });
          }
        }
      });
    });

    events.sort((a, b) => a.time - b.time);
    return { allEvents: events, projectNames: Array.from(projSet) };
  }, [globalStats, selectedVariable]);

  // Групування точок у часі для уникнення перевантаження та зависання інтерфейсу
  const { filteredData, bucketLabel } = useMemo(() => {
    if (!selectedVariable || allEvents.length === 0) return { filteredData: [], bucketLabel: '' };

    const now = Date.now();
    let cutoff = 0;
    if (selectedPeriod === '24h') cutoff = now - 24 * 60 * 60 * 1000;
    else if (selectedPeriod === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (selectedPeriod === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;

    const events = cutoff > 0 ? allEvents.filter(e => e.time >= cutoff) : allEvents;
    if (events.length === 0) return { filteredData: [], bucketLabel: '' };

    const minTime = events[0].time;
    const maxTime = events[events.length - 1].time;
    const span = Math.max(0, maxTime - minTime);

    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    let bucketMs: number;
    if (selectedGrouping === '1h') {
      bucketMs = HOUR;
    } else if (selectedGrouping === '6h') {
      bucketMs = 6 * HOUR;
    } else if (selectedGrouping === '1d') {
      bucketMs = DAY;
    } else if (selectedGrouping === 'raw') {
      bucketMs = 5 * MINUTE;
    } else {
      // 'auto': підбираємо інтервал так, щоб отримати близько 40–80 точок на графіку
      const targetPoints = 60;
      const rawBucket = span / targetPoints;

      if (rawBucket <= 5 * MINUTE) bucketMs = 5 * MINUTE;
      else if (rawBucket <= 15 * MINUTE) bucketMs = 15 * MINUTE;
      else if (rawBucket <= 30 * MINUTE) bucketMs = 30 * MINUTE;
      else if (rawBucket <= HOUR) bucketMs = HOUR;
      else if (rawBucket <= 2 * HOUR) bucketMs = 2 * HOUR;
      else if (rawBucket <= 4 * HOUR) bucketMs = 4 * HOUR;
      else if (rawBucket <= 6 * HOUR) bucketMs = 6 * HOUR;
      else if (rawBucket <= 12 * HOUR) bucketMs = 12 * HOUR;
      else if (rawBucket <= DAY) bucketMs = DAY;
      else if (rawBucket <= 2 * DAY) bucketMs = 2 * DAY;
      else if (rawBucket <= 7 * DAY) bucketMs = 7 * DAY;
      else bucketMs = Math.ceil(rawBucket / DAY) * DAY;
    }

    let label = '';
    if (bucketMs >= DAY) {
      const days = Math.round(bucketMs / DAY);
      label = days === 1 ? '1 день' : `${days} дн.`;
    } else if (bucketMs >= HOUR) {
      const hours = Math.round(bucketMs / HOUR);
      label = `${hours} год.`;
    } else {
      const mins = Math.round(bucketMs / MINUTE);
      label = `${mins} хв.`;
    }

    const bucketMap = new Map<number, any>();
    const lastKnownValue: Record<string, number> = {};

    events.forEach(ev => {
      lastKnownValue[ev.proj] = ev.val;
      const bucketTime = Math.floor(ev.time / bucketMs) * bucketMs;

      if (!bucketMap.has(bucketTime)) {
        bucketMap.set(bucketTime, {
          timestamp: bucketTime,
          ...lastKnownValue
        });
      } else {
        const point = bucketMap.get(bucketTime);
        point[ev.proj] = ev.val;
      }
    });

    const points = Array.from(bucketMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    let currentFill: Record<string, number> = {};
    points.forEach(p => {
      projectNames.forEach(proj => {
        if (p[proj] !== undefined) {
          currentFill[proj] = p[proj];
        } else if (currentFill[proj] !== undefined) {
          p[proj] = currentFill[proj];
        }
      });

      if (bucketMs >= DAY) {
        p.time = new Date(p.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        p.time = new Date(p.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    });

    return { filteredData: points, bucketLabel: label };
  }, [allEvents, projectNames, selectedVariable, selectedPeriod, selectedGrouping]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal-high)] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-5xl h-[94vh] md:h-[85vh] flex flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between p-3 md:p-4 gap-2 border-b border-white/10 shrink-0 bg-white/5">
          <div className="flex items-center gap-2.5 md:gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)] border border-[var(--accent-purple)]/30 shadow-inner">
              <Globe size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[var(--accent-purple)] tracking-widest">Загальна Статистика</p>
              <h2 className="text-[13px] md:text-[14px] font-bold text-[var(--interface-text-primary)] mt-0.5">Всі проекти</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {availableVars.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 md:gap-3 bg-black/30 p-1 md:p-1.5 rounded-lg border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 pl-1.5 md:pl-2 border-r border-white/10 pr-2 md:pr-3">
                  <Filter size={13} className="text-slate-400" />
                  <select
                    value={selectedVariable}
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    className="bg-transparent text-xs md:text-sm font-bold text-slate-200 outline-none cursor-pointer max-w-[120px] sm:max-w-none"
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
                  className="bg-transparent text-xs md:text-sm text-slate-300 outline-none pr-1.5 md:pr-2 cursor-pointer"
                >
                  <option value="all" className="bg-slate-800">За весь час</option>
                  <option value="24h" className="bg-slate-800">Останні 24 години</option>
                  <option value="7d" className="bg-slate-800">Останні 7 днів</option>
                  <option value="30d" className="bg-slate-800">Останні 30 днів</option>
                </select>

                <div className="flex items-center gap-1 pl-1.5 border-l border-white/10">
                  <Layers size={13} className="text-slate-400" />
                  <select
                    value={selectedGrouping}
                    onChange={(e) => setSelectedGrouping(e.target.value)}
                    className="bg-transparent text-xs md:text-sm text-slate-300 outline-none pr-1.5 md:pr-2 cursor-pointer"
                    title="Групування точок у часі"
                  >
                    <option value="auto" className="bg-slate-800">Авто (групування)</option>
                    <option value="1h" className="bg-slate-800">1 година</option>
                    <option value="6h" className="bg-slate-800">6 годин</option>
                    <option value="1d" className="bg-slate-800">1 день</option>
                    <option value="raw" className="bg-slate-800">Без групування</option>
                  </select>
                </div>
              </div>
            )}
            
            <button onClick={loadStats} className="p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors" title="Оновити">
              <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors bg-[var(--button-danger-bg)]/10 hover:bg-[var(--button-danger-bg)]/30 text-[var(--button-danger-bg)]">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-3 md:p-6 overflow-hidden flex flex-col gap-4 md:gap-6 relative">
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
                  <div className="flex items-center justify-between mb-4 ml-2 mr-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Динаміка зміни: <span className="text-purple-400">{selectedVariable}</span> (по проектах)
                    </h3>
                    <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 font-medium">
                      Згруповано: <span className="text-purple-300 font-bold">{filteredData.length}</span> точок {bucketLabel ? `(крок: ${bucketLabel})` : ''}
                    </span>
                  </div>
                  
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
                            dot={filteredData.length <= 60 ? { r: 2.5, strokeWidth: 1 } : false}
                            activeDot={{ r: 5 }}
                            connectNulls={true}
                            isAnimationActive={false}
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
