// Нода API запиту — отримує дані від Sunflower Land або інших серверів
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { CloudDownload, Key, Database, ChevronRight, ChevronDown, Copy, Check, Globe, Download, Radio, Settings } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Компонент для візуалізації JSON дерева з можливістю копіювання шляху до змінної
const JsonTree = ({ data, path = '', depth = 0 }: { data: any, path?: string, depth?: number }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Копіювання JSON-шляху (наприклад balance.inventory.wood)
  const copyPath = (fullPath: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = fullPath;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      window.prompt('Скопіюйте шлях:', fullPath);
    }
    setCopiedPath(fullPath);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic text-[9px]">null</span>;
  }

  if (typeof data === 'object') {
    const entries = Array.isArray(data) 
      ? data.map((v, i) => [String(i), v] as [string, any])
      : Object.entries(data);

    if (depth > 4) {
      return <span className="text-muted-foreground text-[9px]">{Array.isArray(data) ? `[${data.length}]` : `{${entries.length}}`}</span>;
    }

    return (
      <div className="space-y-0">
        {entries.map(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          const isObject = value !== null && typeof value === 'object';
          const isOpen = expanded[fullPath] ?? (depth < 1);

          return (
            <div key={fullPath} className="ml-2">
              <div className="flex items-center gap-0.5 group">
                {isObject ? (
                  <button onClick={() => toggle(fullPath)} className="p-0 hover:text-primary text-muted-foreground shrink-0">
                    {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  </button>
                ) : (
                  <span className="w-[10px] shrink-0" />
                )}
                <span className="text-[9px] text-primary font-semibold shrink-0">{key}</span>
                <span className="text-[9px] text-muted-foreground mx-0.5">:</span>
                {isObject ? (
                  <span className="text-[9px] text-slate-400">
                    {Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`}
                  </span>
                ) : (
                  <button
                    onClick={() => copyPath(fullPath)}
                    className="text-[9px] font-mono truncate max-w-[120px] text-left hover:bg-primary/20 px-1 rounded transition-colors group/val flex items-center gap-1"
                    title={`Клікни щоб скопіювати: ${fullPath}`}
                  >
                    <span className={
                      typeof value === 'number' ? 'text-emerald-600 font-bold' :
                      typeof value === 'boolean' ? 'text-amber-600 font-bold' :
                      typeof value === 'string' ? 'text-rose-600' : 'text-slate-600'
                    }>
                      {typeof value === 'string' ? `"${value.substring(0, 20)}${value.length > 20 ? '…' : ''}"` : String(value)}
                    </span>
                    {copiedPath === fullPath ? (
                      <Check size={8} className="text-emerald-500 shrink-0" />
                    ) : (
                      <Copy size={8} className="text-slate-300 opacity-0 group-hover/val:opacity-100 shrink-0" />
                    )}
                  </button>
                )}
              </div>
              {isObject && isOpen && (
                <JsonTree data={value} path={fullPath} depth={depth + 1} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-[9px] text-slate-600">{String(data)}</span>;
};

const ApiNode = memo(({ id, data }: { id: string, data: any }) => {
  const IconComponent = data.customIcon && (LucideIcons as any)[data.customIcon] 
    ? (LucideIcons as any)[data.customIcon] 
    : CloudDownload;

  // Поточний режим: 'manual' або 'intercept'
  const mode = data.mode || 'manual';

  // Функція для завантаження JSON результату у файл
  const downloadJson = () => {
    if (!data.lastResponse) return;
    const blob = new Blob([JSON.stringify(data.lastResponse, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api_response_${data.farmId || id}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BaseNode id={id} data={data} icon={<IconComponent size={16} />} title={data.label || 'API Запит'} bgColor="bg-indigo-600" type="apiNode" width="w-80">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#6366f1', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      {/* Вихід успіху — запит виконано успішно */}
      <Handle type="source" id="success" position={Position.Right} style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '170px', data.miniCollapsed)} className="!right-[-6px]" />
      {/* Вихід помилки — HTTP помилка, невалідний URL, тощо */}
      <Handle type="source" id="error" position={Position.Right} style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '194px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          
          {/* Перемикач режиму роботи */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => data.onDataChange(id, { mode: 'manual' })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold uppercase transition-colors ${
                mode === 'manual' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Settings size={10} />
              Ручний
            </button>
            <button
              onClick={() => data.onDataChange(id, { mode: 'intercept' })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold uppercase transition-colors ${
                mode === 'intercept' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Radio size={10} />
              Перехоплення
            </button>
          </div>

          {/* Ручний режим */}
          {mode === 'manual' && (
            <>
              <div className="space-y-1">
                 <div className="text-[8px] font-bold text-muted-foreground uppercase">Farm ID</div>
                 <Input 
                   value={data.farmId || '734393424627289'} 
                   onChange={(e) => {
                     const val = e.target.value;
                     data.onDataChange(id, { farmId: val, url: `https://api.sunflower-land.com/visit/${val}` });
                   }} 
                   placeholder="73439342..." 
                   className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
                 />
              </div>
              
              <div className="space-y-1">
                 <div className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                   <Globe size={10} /> Endpoint URL
                 </div>
                 <Input 
                   value={data.url || `https://api.sunflower-land.com/visit/${data.farmId || '734393424627289'}`} 
                   onChange={(e) => data.onDataChange(id, { url: e.target.value })} 
                   placeholder="https://api..." 
                   className="h-7 text-[10px] border-border bg-muted text-muted-foreground" 
                 />
              </div>

              <div className="space-y-1">
                 <div className="text-[8px] font-bold text-muted-foreground uppercase">Bearer Token</div>
                 <div className="flex items-center gap-2 bg-muted p-1 rounded border border-border">
                    <Key size={12} className="text-muted-foreground" />
                    <Input type="text" value={data.apiKey || ''} onChange={(e) => data.onDataChange(id, { apiKey: e.target.value })} placeholder="eyJ..." className="h-6 text-[10px] border-none bg-transparent p-0 focus-visible:ring-0 text-foreground" />
                 </div>
              </div>
            </>
          )}

          {/* Режим перехоплення */}
          {mode === 'intercept' && (
            <div className="space-y-2">
              <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-lg p-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <Radio size={12} className="text-emerald-400 mt-0.5 shrink-0 animate-pulse" />
                  <p className="text-[9px] text-emerald-300 leading-relaxed">
                    Браузер постійно відстежує мережу у фоні. Під час запуску нода миттєво візьме останні відомі Farm ID та Bearer токен і зробить запит до API.
                  </p>
                </div>
              </div>

              {/* Показуємо перехоплені дані, якщо вже є */}
              {data.farmId && (
                <div className="bg-muted/40 rounded border border-emerald-700/30 p-2 space-y-1">
                  <div className="text-[8px] text-emerald-400 font-bold uppercase">Перехоплено:</div>
                  <div className="text-[9px] text-slate-300">Farm ID: <span className="text-emerald-300 font-mono">{data.farmId}</span></div>
                  <div className="text-[9px] text-slate-300">Токен: <span className="text-emerald-300 font-mono">{data.apiKey ? `${data.apiKey.substring(0, 20)}...` : 'не знайдено'}</span></div>
                </div>
              )}
            </div>
          )}

          {/* Опція збереження отриманої відповіді у файли проекту */}
          <div className="pt-2 border-t border-border"> {/* Контейнер для налаштування збереження */}
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-bold uppercase"> {/* Контейнер-підпис для чекбоксу */}
              <input // Елемент введення чекбокс
                type="checkbox" // Встановлення типу чекбокс
                checked={data.saveToProject || false} // Поточне значення чекбоксу з властивостей
                onChange={(e) => data.onDataChange(id, { saveToProject: e.target.checked })} // Збереження статусу при зміні
                className="rounded bg-muted/50 border-border text-indigo-500 focus:ring-indigo-500 w-3 h-3" // Класи оформлення чекбоксу
              /> {/* Закриття тегу чекбоксу */}
              <span>Зберегти в проект</span> {/* Текст опису чекбоксу */}
            </label> {/* Закриття тегу підпису */}
          </div> {/* Закриття контейнера */}

          {/* Результат (спільний для обох режимів) */}
          <div className="bg-muted/30 rounded border border-border p-2 space-y-1">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                   <Database size={10} />
                   <span>Дані (клік = копія шляху)</span>
                </div>
                {data.lastResponse && (
                  <button 
                    onClick={downloadJson}
                    className="p-1 text-indigo-400 hover:text-emerald-400 transition-colors"
                    title="Завантажити JSON результат"
                  >
                    <Download size={12} />
                  </button>
                )}
             </div>
              <div className="bg-background/50 p-1.5 rounded border border-border min-h-[60px] max-h-[200px] overflow-y-auto custom-scrollbar">
                {data.lastResponse ? <JsonTree data={data.lastResponse} /> : <div className="text-[9px] text-muted-foreground italic p-2 text-center">Натисніть ▶ щоб отримати дані</div>}
              </div>
          </div>

          {/* Підписи портів */}
          <div className="space-y-1 border-t border-border pt-2">
            <div className="flex items-center justify-end gap-1.5 text-[9px] text-green-400">
              <div className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
              Успіх (дані отримано)
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[9px] text-red-400">
              <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
              Помилка (HTTP хиба / невалідний URL)
            </div>
          </div>

        </div>
      )}
    </BaseNode>
  );
});

export default ApiNode;
