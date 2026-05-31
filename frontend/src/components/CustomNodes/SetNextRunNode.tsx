import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const SetNextRunNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const mode = data.scheduleMode || 'delay';
  const delayValue = data.delayValue !== undefined ? data.delayValue : 2;
  const delayUnit = data.delayUnit || 'hours';
  const targetTime = data.targetTime || '08:00';

  const handleChange = (field: string, val: any) => {
    data.onDataChange(id, { [field]: val });
  };

  return (
    <BaseNode id={id} data={data} icon={<CalendarClock size={16} />} title="Наступний запуск" bgColor="bg-sky-500" type="setNextRunNode" width="w-48">
      {/* Вхідний сигнал */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#0ea5e9', mini ? '50%' : '20px', mini)} className="!left-[-6px]" />
      
      {/* Вихідний сигнал (просто йде далі) */}
      <Handle type="source" position={Position.Right} id="out" style={getHandleStyle('#0ea5e9', mini ? '50%' : '20px', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
            <select 
              value={mode}
              onChange={(e) => handleChange('scheduleMode', e.target.value)}
              className="w-full h-7 mb-2 text-xs bg-slate-800 border border-slate-700 rounded-md outline-none text-slate-200 px-1"
            >
              <option value="delay">Через N часу</option>
              <option value="fixedTime">У заданий час</option>
            </select>

            {mode === 'delay' ? (
              <div className="flex gap-2">
                <Input 
                  type="number"
                  value={delayValue}
                  onChange={(e) => handleChange('delayValue', Number(e.target.value))}
                  min={1}
                  className="w-16 h-7 text-xs bg-slate-800 border-slate-700"
                />
                <select 
                  value={delayUnit}
                  onChange={(e) => handleChange('delayUnit', e.target.value)}
                  className="flex-1 h-7 text-xs bg-slate-800 border border-slate-700 rounded-md outline-none text-slate-200 px-1"
                >
                  <option value="minutes">Хвилин</option>
                  <option value="hours">Годин</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Час:</span>
                <Input 
                  type="time"
                  value={targetTime}
                  onChange={(e) => handleChange('targetTime', e.target.value)}
                  className="flex-1 h-7 text-xs bg-slate-800 border-slate-700"
                />
              </div>
            )}
          </div>
          
          <div className="text-[9px] text-muted-foreground flex gap-1.5 p-1">
            <AlertCircle size={10} className="shrink-0 text-amber-500" />
            <p>
              Встановлює час наступного запуску проекту в фоновому планувальнику. Запуск відбудеться навіть якщо інтерфейс буде закрито.
            </p>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default SetNextRunNode;
