import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Type, HelpCircle, ArrowRightLeft } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';
import { Input } from '../ui/input';

const TextInputNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const selector = data.selector || '';
  const text = data.text || '';
  const clearFirst = data.clearFirst !== undefined ? data.clearFirst : true;
  const pressEnter = data.pressEnter !== undefined ? data.pressEnter : false;
  const delayBetweenKeys = data.delayBetweenKeys || 0;

  const handleChange = (field: string, val: any) => {
    data.onDataChange(id, { [field]: val });
  };

  return (
    <BaseNode id={id} data={data} icon={<Type size={16} />} title="Введення Тексту" bgColor="bg-blue-600" type="textInputNode" width="w-64">
      {/* ── Вхідні порти (Left) ── */}
      {/* Сигнал виконання */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={getHandleStyle('#2563eb', mini ? '50%' : '20px', mini)} 
        className="!left-[-6px]" 
      />
      {/* Точка входу для тексту (динамічне значення з іншої ноди) */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="text_input" 
        style={getHandleStyle('#f59e0b', mini ? '50%' : '65px', mini)} 
        className="!left-[-6px] !bg-amber-500" 
      />

      {/* ── Вихідні порти (Right) ── */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="success" 
        style={getHandleStyle('#22c55e', mini ? '50%' : '20px', mini)} 
        className="!right-[-6px] !bg-green-500" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="error" 
        style={getHandleStyle('#ef4444', mini ? '50%' : '45px', mini)} 
        className="!right-[-6px] !top-[45px] !bg-red-500" 
      />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Мітка точки входу тексту */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-[9px] font-bold text-amber-400">
            <ArrowRightLeft size={11} className="shrink-0" />
            <span>Порт "Вхід тексту" (зліва)</span>
          </div>

          {/* Селектор поля введення */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">
              Селектор поля (Input / Textarea):
            </label>
            <Input 
              type="text"
              value={selector}
              onChange={(e) => handleChange('selector', e.target.value)}
              placeholder="напр. input[name='username']"
              className="h-7 text-xs bg-slate-800 border-slate-700 focus:border-blue-500"
            />
          </div>

          {/* Текст або шаблон */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1 flex items-center justify-between">
              <span>Текст або шаблон:</span>
              <HelpCircle size={10} className="text-muted-foreground" title="Якщо підключено порт 'Вхід тексту', значення береться з нього. Підтримує {змінні}." />
            </label>
            <textarea
              value={text}
              onChange={(e) => handleChange('text', e.target.value)}
              placeholder="напр. Текст для вставки або {varName}"
              className="w-full h-16 text-xs bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 outline-none resize-none focus:border-blue-500 transition-colors custom-scrollbar"
            />
          </div>

          {/* Опції */}
          <div className="space-y-2 pt-1 border-t border-slate-700/50">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 select-none">
              <input 
                type="checkbox"
                checked={clearFirst}
                onChange={(e) => handleChange('clearFirst', e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
              />
              <span>Очистити поле перед вводом</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 select-none">
              <input 
                type="checkbox"
                checked={pressEnter}
                onChange={(e) => handleChange('pressEnter', e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
              />
              <span>Натиснути Enter після вводу</span>
            </label>
          </div>

          {/* Затримка між символами */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1 flex items-center gap-1">
              <span>Затримка клавіш (мс):</span>
              <HelpCircle size={10} className="text-muted-foreground" title="0 = миттєве заповнення (fill), >0 = посимвольне друкування" />
            </label>
            <Input 
              type="number"
              value={delayBetweenKeys}
              onChange={(e) => handleChange('delayBetweenKeys', Number(e.target.value))}
              min={0}
              step={10}
              className="h-7 text-xs bg-slate-800 border-slate-700 focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default TextInputNode;
