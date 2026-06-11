import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sprout, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Тип одного рядка правила
interface ScheduleRule {
  fromMin: number;       // Якщо залишилось більше ніж ця кількість хвилин
  toMin: number;         // І менше ніж ця кількість хвилин
  scheduleFromMin: number; // Запланувати запуск через не менше ніж X хвилин
  scheduleToMin: number;   // І не більше ніж Y хвилин
}

const CropAnalyzerNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const variableName = data.variableName || 'nextCropHarvest';

  // Масив правил — завантажуємо з data.scheduleRules або пустий масив
  const rules: ScheduleRule[] = data.scheduleRules || [];

  const handleChange = (field: string, val: any) => {
    data.onDataChange(id, { [field]: val });
  };

  // Оновити одне поле конкретного правила
  const updateRule = (index: number, field: keyof ScheduleRule, val: string) => {
    const updated = rules.map((r, i) =>
      i === index ? { ...r, [field]: Number(val) || 0 } : r
    );
    handleChange('scheduleRules', updated);
  };

  // Додати нове правило
  const addRule = () => {
    const lastRule = rules[rules.length - 1];
    const newRule: ScheduleRule = {
      fromMin: lastRule ? lastRule.toMin : 0,
      toMin: lastRule ? lastRule.toMin + 60 : 60,
      scheduleFromMin: 5,
      scheduleToMin: 10,
    };
    handleChange('scheduleRules', [...rules, newRule]);
  };

  // Видалити правило за індексом
  const removeRule = (index: number) => {
    handleChange('scheduleRules', rules.filter((_, i) => i !== index));
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Sprout size={16} />}
      title="Аналізатор врожаю"
      bgColor="bg-green-600"
      type="cropAnalyzerNode"
      width="w-72"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#16a34a', mini ? '50%' : '20px', mini)}
        className="!left-[-6px]"
      />

      {/* Вихід "Є врожай / порожньо" — верхній зелений порт */}
      <Handle
        type="source"
        position={Position.Right}
        id="ready"
        style={getHandleStyle('#16a34a', mini ? '50%' : '30px', mini)}
        className="!right-[-6px]"
      />

      {/* Вихід "Запланувати запуск" — нижній синій порт */}
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        style={getHandleStyle('#0ea5e9', mini ? '50%' : '60px', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Поле назви змінної */}
          <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
            <div className="flex flex-col gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-green-500 uppercase">Змінна для збереження часу</span>
              <Input
                type="text"
                value={variableName}
                onChange={(e) => handleChange('variableName', e.target.value)}
                placeholder="напр. nextCropHarvest"
                className="w-full h-7 text-xs bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          {/* Підписи виходів */}
          <div className="flex flex-col gap-1 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-green-400 font-medium">🌾 Є врожай / немає рослин</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
              <span className="text-sky-400 font-medium">⏳ Рослини ростуть → запланувати</span>
            </div>
          </div>

          {/* Таблиця правил розкладу */}
          <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-sky-400 uppercase">Правила розкладу</span>
              <button
                onClick={addRule}
                className="flex items-center gap-0.5 text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Plus size={10} /> Додати
              </button>
            </div>

            {rules.length === 0 && (
              <p className="text-[9px] text-muted-foreground text-center py-1">
                Без правил — лише записує час у змінну
              </p>
            )}

            {/* Заголовки стовпців */}
            {rules.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_16px] gap-1 mb-1 px-1">
                <span className="text-[8px] text-muted-foreground text-center">Від(хв)</span>
                <span className="text-[8px] text-muted-foreground text-center">До(хв)</span>
                <span className="text-[8px] text-muted-foreground text-center">→Від(хв)</span>
                <span className="text-[8px] text-muted-foreground text-center">→До(хв)</span>
                <span />
              </div>
            )}

            {/* Рядки правил */}
            <div className="space-y-1">
              {rules.map((rule, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_16px] gap-1 items-center">
                  {/* Від скількох хвилин до врожаю */}
                  <Input
                    type="number"
                    min={0}
                    value={rule.fromMin}
                    onChange={(e) => updateRule(i, 'fromMin', e.target.value)}
                    className="h-6 text-[10px] bg-slate-800 border-slate-700 px-1"
                  />
                  {/* До скількох хвилин */}
                  <Input
                    type="number"
                    min={0}
                    value={rule.toMin}
                    onChange={(e) => updateRule(i, 'toMin', e.target.value)}
                    className="h-6 text-[10px] bg-slate-800 border-slate-700 px-1"
                  />
                  {/* Мінімальна затримка запуску */}
                  <Input
                    type="number"
                    min={1}
                    value={rule.scheduleFromMin}
                    onChange={(e) => updateRule(i, 'scheduleFromMin', e.target.value)}
                    className="h-6 text-[10px] bg-slate-900 border-sky-900 px-1"
                  />
                  {/* Максимальна затримка запуску */}
                  <Input
                    type="number"
                    min={1}
                    value={rule.scheduleToMin}
                    onChange={(e) => updateRule(i, 'scheduleToMin', e.target.value)}
                    className="h-6 text-[10px] bg-slate-900 border-sky-900 px-1"
                  />
                  {/* Кнопка видалення */}
                  <button
                    onClick={() => removeRule(i)}
                    className="text-red-400 hover:text-red-300 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>

            {/* Пояснення колонок */}
            {rules.length > 0 && (
              <p className="text-[8px] text-muted-foreground mt-2">
                Перші 2 — коли виросте (хв), останні 2 — через скільки запустити (хв).
              </p>
            )}
          </div>

          {/* Підказка */}
          <div className="text-[9px] text-muted-foreground flex gap-1.5 p-1">
            <AlertCircle size={10} className="shrink-0 text-amber-500 mt-0.5" />
            <p>
              Якщо є дозрілий врожай — виходить через <span className="text-green-400">зелений</span> порт.
              Якщо рослини ростуть і є правило — планує запуск і виходить через <span className="text-sky-400">синій</span> порт.
            </p>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default CropAnalyzerNode;
