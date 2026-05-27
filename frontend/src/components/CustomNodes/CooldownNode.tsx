import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Timer, Clock, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

const CooldownNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const duration = data.duration !== undefined ? data.duration : 20;
  const unit = data.unit || 'minutes';

  const handleChange = (field: string, val: any) => {
    data.onDataChange(id, { [field]: val });
  };

  return (
    <BaseNode id={id} data={data} icon={<Timer size={16} />} title="Таймаут (Cooldown)" bgColor="bg-teal-600" type="cooldownNode" width="w-48">
      {/* Вхідний сигнал */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#0d9488', mini ? '50%' : '20px', mini)} className="!left-[-6px]" />
      
      {/* Зелений вихід - Пропущено (час вийшов) */}
      <Handle type="source" position={Position.Right} id="success" style={getHandleStyle('#22c55e', mini ? '50%' : '30px', mini)} className="!right-[-6px]" />
      
      {/* Червоний вихід - Заблоковано (ще діє таймаут) */}
      <Handle type="source" position={Position.Right} id="blocked" style={getHandleStyle('#ef4444', mini ? '50%' : '75px', mini)} className="!right-[-6px]" />

      {!mini && (
        <div className="p-3 space-y-3">
          <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={12} className="text-teal-500" />
              <span className="text-[10px] font-bold text-teal-500 uppercase">Період таймауту</span>
            </div>
            
            <div className="flex gap-2">
              <Input 
                type="number"
                value={duration}
                onChange={(e) => handleChange('duration', Number(e.target.value))}
                min={1}
                className="w-16 h-7 text-xs bg-slate-800 border-slate-700"
              />
              <select 
                value={unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="flex-1 h-7 text-[10px] bg-slate-800 border border-slate-700 rounded-md outline-none text-slate-200 px-1"
              >
                <option value="seconds">Секунд</option>
                <option value="minutes">Хвилин</option>
                <option value="hours">Годин</option>
              </select>
            </div>
          </div>
          
          <div className="text-[9px] text-muted-foreground flex gap-1.5 p-1">
            <AlertCircle size={10} className="shrink-0 text-amber-500" />
            <p>
              Пропустить сигнал через <span className="text-green-500 font-bold">зелений</span> порт раз на вказаний час. Всі наступні підуть у <span className="text-red-500 font-bold">червоний</span>.
            </p>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CooldownNode;
