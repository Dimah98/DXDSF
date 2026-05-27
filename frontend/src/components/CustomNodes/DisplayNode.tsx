// Нода виводу даних — показує результати сканування та дозволяє їх зберігати
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Monitor, Terminal, Trash2, Download, Eye, FileJson } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const DisplayNode = memo(({ id, data }: any) => {
  // Функція для завантаження даних у файл JSON
  const downloadData = () => {
    const dataToSave = data.rawData || { info: data.value };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_${id}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Функція для очищення
  const clearDisplay = () => {
    data.onDataChange?.(id, { value: null, rawData: null });
  };

  return (
    <BaseNode id={id} data={data} icon={<Monitor size={16} />} title="Вивід" bgColor="bg-slate-600" type="displayNode">
      {/* Вхідний порт */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#475569', '20px', data.miniCollapsed)} className="!left-[-6px]" />
      
      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="space-y-2">
             <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                   <Terminal size={12} /> Отримані дані
                </label>
                <div className="flex gap-1">
                   {/* Кнопка завантаження */}
                   <button 
                     onClick={downloadData}
                     disabled={!data.value}
                     className="p-1 text-slate-400 hover:text-emerald-400 disabled:opacity-30 transition-colors"
                     title="Завантажити JSON"
                   >
                      <Download size={14} />
                   </button>
                   {/* Кнопка очищення */}
                   <button 
                     onClick={clearDisplay}
                     className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                     title="Очистити поле"
                   >
                      <Trash2 size={14} />
                   </button>
                </div>
             </div>

             {/* Вікно виводу */}
             <div className="bg-[#0f172a] p-2.5 rounded-md border border-slate-700/50 min-h-[100px] max-h-[250px] overflow-y-auto custom-scrollbar group relative">
                <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                   {data.value ? (
                     data.showRaw ? JSON.stringify(data.rawData || {}, null, 2) : data.value
                   ) : (
                     <span className="text-slate-600 italic">Чекаємо на сигнал...</span>
                   )}
                </pre>
                
                {/* Перемикач Raw/Simple */}
                {data.rawData && (
                   <button 
                     onClick={() => data.onDataChange(id, { showRaw: !data.showRaw })}
                     className="absolute top-2 right-2 p-1 bg-slate-800/80 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-slate-300 flex items-center gap-1 border border-slate-700"
                   >
                      {data.showRaw ? <Eye size={10} /> : <FileJson size={10} />}
                      {data.showRaw ? 'Прев\'ю' : 'Full JSON'}
                   </button>
                )}
             </div>

             {/* Додаткова статистика якщо є rawData */}
             {data.rawData && !data.showRaw && (
                <div className="flex gap-2 pt-1">
                   <span className="text-[9px] bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-400">
                      Keys: {Object.keys(data.rawData).length}
                   </span>
                   {data.rawData.coords && (
                      <span className="text-[9px] bg-blue-500/10 px-1.5 py-0.5 rounded text-blue-400 border border-blue-500/20">
                         Has Coords
                      </span>
                   )}
                </div>
             )}
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default DisplayNode;
