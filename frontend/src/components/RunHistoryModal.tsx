import React, { useEffect, useState, useMemo } from 'react';
import { X, RefreshCw, FileText, ToggleLeft, ToggleRight } from 'lucide-react';

interface RunRecord {
  runId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error' | 'stopped';
  error?: string;
}

interface RunHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

interface ParsedLog {
  id: string;
  timestamp: string;
  level: string;
  container: string | null;
  node: string | null;
  message: string;
  raw: string;
  isError: boolean;
}

const RunHistoryModal: React.FC<RunHistoryModalProps> = ({ isOpen, onClose, projectName }) => {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isMinimalMode, setIsMinimalMode] = useState(true);

  useEffect(() => {
    if (isOpen && projectName) {
      fetchRuns();
    }
  }, [isOpen, projectName]);

  useEffect(() => {
    if (selectedRun) {
      fetchLogs(selectedRun);
    } else {
      setLogs('');
    }
  }, [selectedRun]);

  const fetchRuns = async () => {
    try {
      const res = await fetch(`/api/projects/${projectName}/runs`);
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async (runId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectName}/runs/${runId}/logs`);
      const text = await res.text();
      setLogs(text);
    } catch (e) {
      setLogs('Error loading logs.');
    } finally {
      setLoading(false);
    }
  };

  const parsedLogs = useMemo(() => {
    if (!logs) return [];
    const lines = logs.split('\n').filter(l => l.trim());
    const parsed: ParsedLog[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\[(.*?)\] \[(.*?)\] (?:\[(.*?)\] )?(?:  ↳ \[(.*?)\] )?(.*)$/);
      
      if (match) {
        let container = match[3] || null;
        let node = match[4] || null;
        let message = match[5];
        
        let virtualNode = node;
        if (!node && container) {
          if (message.includes('↳ ⏱️ Затримка')) {
            virtualNode = message.replace('↳ ', '').trim();
          } else if (message.includes('Підпрограма завершена') || message.match(/^🏁 \d+мс/)) {
            virtualNode = container + ' (Завершення)';
          } else {
            virtualNode = container;
            container = null;
          }
        }

        parsed.push({
          id: `log_${i}`,
          timestamp: match[1],
          level: match[2],
          container,
          node: virtualNode,
          message: message,
          raw: line,
          isError: match[2] === 'ERROR' || message.includes('❌') || message.toLowerCase().includes('error'),
        });
      } else {
        parsed.push({
          id: `log_${i}`,
          timestamp: '',
          level: '',
          container: null,
          node: null,
          message: line,
          raw: line,
          isError: line.includes('❌') || line.toLowerCase().includes('error'),
        });
      }
    }
    return parsed;
  }, [logs]);

  const renderLogs = () => {
    if (!isMinimalMode) {
      return parsedLogs.map(log => {
        let color = 'text-slate-300';
        if (log.isError) color = 'text-red-400 font-bold';
        else if (log.level === 'SUCCESS') color = 'text-green-400';
        else if (log.level === 'INFO') color = 'text-blue-300';
        else if (log.level === 'DEBUG') color = 'text-slate-500';
    
        const timeStr = log.timestamp ? log.timestamp.split('T')[1]?.replace('Z', '') : '';
        const msgStr = log.timestamp ? log.raw.substring(log.raw.indexOf(']') + 2) : log.raw;
    
        return (
          <div key={log.id} className={`font-mono text-[11px] py-0.5 hover:bg-white/5 px-2 rounded flex gap-3 transition-colors ${color}`}>
            <span className="text-slate-700 shrink-0 select-none">[{timeStr}]</span>
            <span className="break-all whitespace-pre-wrap">{msgStr}</span>
          </div>
        );
      });
    }

    const summarizeLogs = (logs: ParsedLog[]) => {
       const err = logs.find(l => l.isError && !l.message.includes('Результат') && !l.message.includes('Конфіг'));
       if (err) return { msg: err.message, err: true };
    
       const schedule = logs.find(l => l.message.includes('📅'));
       if (schedule) return { msg: schedule.message, err: false };
    
       const pass = logs.find(l => l.message.includes('Конфіг TRUE') || l.message.includes('Конфіг «'));
       if (pass) {
          const countLog = logs.find(l => l.message.includes('Запуск підпрограми'));
          if (countLog) {
             const m = countLog.message.match(/\(\d+ нод\)/);
             if (m) return { msg: `✅ Умови виконано — запуск ${m[0]}`, err: false };
          }
          if (pass.message.includes('TRUE')) return { msg: `✅ Умови виконано`, err: false };
          if (pass.message.includes('FALSE')) {
             const reason = logs.find(l => l.message.includes('→ false'));
             if (reason) return { msg: `❌ Пропущено: ${reason.message.replace(' → false', '')}`, err: true };
             return { msg: `❌ Пропущено (умови не виконані)`, err: true };
          }
       }
       
       const resLog = logs.find(l => l.message.includes('Результат «'));
       if (resLog) {
          if (resLog.message.includes('TRUE')) return { msg: `✅ Умови виконано`, err: false };
          if (resLog.message.includes('FALSE')) {
             const reason = logs.find(l => l.message.includes('→ false'));
             if (reason) return { msg: `❌ Пропущено: ${reason.message.replace(' → false', '')}`, err: true };
             return { msg: `❌ Пропущено (умови не виконані)`, err: true };
          }
       }
    
       const action = [...logs].reverse().find(l => !l.message.includes('▶️ Старт') && !l.message.match(/^🏁/));
       if (action) return { msg: action.message, err: action.isError };
    
       return { msg: logs[0]?.message || '', err: logs[0]?.isError || false };
    };

    const elements: React.ReactNode[] = [];
    let currentNodeKey: string | null = null;
    let currentNodeLogs: ParsedLog[] = [];
    let isCurrentNodeContainer = false;

    const flushNode = () => {
      if (currentNodeLogs.length === 0) return;
      
      if (isCurrentNodeContainer) {
         const summary = summarizeLogs(currentNodeLogs);
         elements.push(
           <div key={"cnt_" + currentNodeLogs[0].id} className="my-3 p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/20 shadow-inner">
             <div className="font-bold text-indigo-400 mb-2 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
               {currentNodeKey}
             </div>
             <div className="pl-4 border-l-2 border-indigo-500/30">
                <div className={`text-[11px] font-mono leading-relaxed truncate ${summary.err ? 'text-red-400 font-bold' : 'text-slate-300'}`} title={summary.msg}>
                  {summary.msg}
                </div>
             </div>
           </div>
         );
      } else {
         const hasError = currentNodeLogs.some(l => l.isError);
         const errorLog = currentNodeLogs.find(l => l.isError);
         const durationLog = currentNodeLogs.find(l => l.message.match(/🏁 \d+мс/));
         let duration = '';
         if (durationLog) {
           const m = durationLog.message.match(/🏁 (\d+мс)/);
           if (m) duration = m[1];
         }
         
         const nodeName = currentNodeKey?.split(' ↳ ').pop() || currentNodeKey || 'Система';

         elements.push(
           <div key={"node_" + currentNodeLogs[0].id} className={`flex items-center justify-between py-2 px-3 mb-1 rounded-lg border border-white/5 hover:bg-white/5 transition-colors ${hasError ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800/40'}`}>
             <div className="flex items-center gap-3 overflow-hidden">
               <span className="shrink-0 text-sm">{hasError ? '❌' : '✅'}</span>
               <span className={`font-bold truncate text-[12px] ${hasError ? 'text-red-400' : 'text-emerald-400'}`}>{nodeName}</span>
               {hasError && errorLog && <span className="text-slate-400 text-[11px] ml-2 truncate" title={errorLog.message}>{errorLog.message}</span>}
             </div>
             {duration && <span className="text-[10px] text-slate-500 font-mono shrink-0 bg-black/20 px-1.5 py-0.5 rounded">{duration}</span>}
           </div>
         );
      }
      currentNodeLogs = [];
    };

    parsedLogs.forEach(log => {
      if (!log.node && !log.container) {
         flushNode();
         elements.push(<div key={log.id} className="text-slate-500 text-[11px] italic py-1.5 px-3 border-b border-white/5">{log.message}</div>);
         return;
      }

      const key = log.container ? log.container + ' ↳ ' + log.node : log.node;

      if (key !== currentNodeKey) {
         flushNode();
         currentNodeKey = key;
         // Every top-level node gets a box!
         isCurrentNodeContainer = !log.container;
      }
      currentNodeLogs.push(log);
    });
    flushNode();

    return elements;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="flex flex-col md:flex-row bg-[#0f111a] border border-slate-700/50 shadow-2xl rounded-2xl w-full max-w-5xl h-[94vh] md:h-[700px] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Sidebar with runs */}
        <div className={`w-full md:w-80 md:border-r border-white/10 flex flex-col bg-slate-900/80 ${selectedRun ? 'hidden md:flex' : 'flex flex-1 md:flex-initial'}`}>
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 bg-black/20">
            <h3 className="text-slate-200 font-bold text-xs sm:text-sm">Історія запусків ({projectName})</h3>
            <div className="flex items-center gap-2">
              <button onClick={fetchRuns} className="p-1.5 hover:bg-indigo-500/20 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Оновити список">
                <RefreshCw size={14} />
              </button>
              <button onClick={onClose} className="md:hidden p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 custom-scrollbar">
            {runs.length === 0 ? (
              <div className="text-center text-slate-500 text-xs mt-10 italic">Немає збережених запусків</div>
            ) : (
              runs.map(r => (
                <div
                  key={r.runId}
                  onClick={() => setSelectedRun(r.runId)}
                  className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${selectedRun === r.runId ? 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/80'}`}
                >
                  <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                    <span className={`text-[11px] sm:text-[12px] font-bold ${selectedRun === r.runId ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {new Date(r.startTime).toLocaleString('uk-UA')}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'running'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : r.status === 'success'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : r.status === 'stopped'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {r.status === 'stopped' ? 'зупинено' : r.status === 'success' ? 'успішно' : r.status === 'error' ? 'помилка' : 'виконується'}
                    </span>
                  </div>
                  {r.endTime && (
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                      Тривалість: {((r.endTime - r.startTime) / 1000).toFixed(1)}с
                    </div>
                  )}
                  {r.error && (
                    <div className="text-[10px] sm:text-[11px] text-red-400/80 truncate mt-0.5" title={r.error}>
                      ⚠️ {r.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Logs view */}
        <div className={`flex-1 flex flex-col relative bg-[#0b0c10] ${selectedRun ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-2 sm:gap-3">
              {selectedRun && (
                <button
                  onClick={() => setSelectedRun(null)}
                  className="md:hidden px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                >
                  ← Назад
                </button>
              )}
              <FileText size={16} className="text-indigo-400 shrink-0" />
              <h3 className="text-slate-200 font-bold text-xs sm:text-sm truncate">
                {selectedRun ? 'Логи запуску' : 'Виберіть запуск'}
              </h3>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {selectedRun && (
                <button
                  onClick={() => setIsMinimalMode(!isMinimalMode)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all ${isMinimalMode ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  title="Мінімалістичний режим"
                >
                  {isMinimalMode ? <ToggleRight size={16} className="text-indigo-400" /> : <ToggleLeft size={16} />}
                  <span className="text-[10px] sm:text-[11px] font-bold">Мінімалізм</span>
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-2 sm:p-4 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                  <span className="text-slate-400 text-sm font-bold">Завантаження логів...</span>
                </div>
              </div>
            ) : selectedRun ? (
              <div className="flex flex-col h-full">
                {logs ? renderLogs() : <div className="text-slate-500 italic text-center mt-10">Файл логів порожній.</div>}
              </div>
            ) : (
              <div className="text-slate-500 italic flex flex-col h-full items-center justify-center gap-4">
                <FileText size={48} className="text-slate-800" />
                <span className="text-xs sm:text-sm">Виберіть запуск для перегляду логів</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunHistoryModal;
