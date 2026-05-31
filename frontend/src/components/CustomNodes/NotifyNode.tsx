import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bell, Info } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

const NotifyNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const message = data.message || 'Бот {project} завершив роботу';

  const handleChange = (val: string) => {
    data.onDataChange(id, { message: val });
  };

  return (
    <BaseNode id={id} data={data} icon={<Bell size={16} />} title="Сповіщення" bgColor="bg-amber-500" type="notifyNode" width="w-56">
      <Handle type="target" position={Position.Left} style={getHandleStyle('#f59e0b', mini ? '50%' : '20px', mini)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} id="out" style={getHandleStyle('#f59e0b', mini ? '50%' : '20px', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">
              Текст сповіщення:
            </label>
            <textarea
              value={message}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full h-20 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 text-slate-200 outline-none resize-none focus:border-amber-500/50 focus:bg-slate-800 transition-colors custom-scrollbar"
              placeholder="Введіть текст..."
            />
          </div>
          
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <div className="flex gap-1.5 items-start">
              <Info size={12} className="shrink-0 text-amber-500 mt-0.5" />
              <div className="text-[9px] text-muted-foreground space-y-1">
                <p>Доступні змінні:</p>
                <ul className="list-disc pl-3 text-slate-400">
                  <li><span className="text-amber-400 font-mono">{"{project}"}</span> — назва проекту</li>
                  <li><span className="text-amber-400 font-mono">{"{time}"}</span> — поточний час</li>
                  <li><span className="text-amber-400 font-mono">{"{varName}"}</span> — глобальна змінна</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default NotifyNode;
