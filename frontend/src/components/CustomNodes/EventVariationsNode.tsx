// Нода Диспетчер подій — перевіряє список умов по пріоритету та направляє сигнал у відповідний порт
import React, { memo, useCallback, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { GitFork, Plus, Trash2, Zap } from 'lucide-react';
import { Input } from '../ui/input';
import BaseNode, { getHandleStyle } from './BaseNode';

// Кольори типів умов
const TYPE_COLORS: Record<string, string> = {
  text:     '#3b82f6', // синій
  selector: '#f59e0b', // жовтий
  image:    '#10b981', // зелений
};

// Позиція першого порту від верху ноди (заголовок ~32px + padding + label ~30px)
const FIRST_PORT_TOP = 90;
// Відстань між портами (висота одного рядка правила)
const PORT_STEP = 52;

const EventVariationsNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const rules: any[] = data.rules || [];
  const updateNodeInternals = useUpdateNodeInternals();

  // Оновлюємо handles в React Flow кожного разу коли змінюється кількість правил
  useEffect(() => {
    updateNodeInternals(id);
    // Другий виклик з затримкою — для надійності після анімації
    const t = setTimeout(() => updateNodeInternals(id), 200);
    return () => clearTimeout(t);
  }, [id, rules.length, mini, updateNodeInternals]);

  // Оновлення масиву правил через колбек ноди
  const updateRules = useCallback((newRules: any[]) => {
    data.onDataChange?.(id, { rules: newRules });
  }, [id, data.onDataChange]);

  // Додати нове правило в кінець списку
  const addRule = () => {
    updateRules([...rules, { type: 'text', value: '' }]);
  };

  // Видалити правило по індексу
  const removeRule = (index: number) => {
    const next = [...rules];
    next.splice(index, 1);
    updateRules(next);
  };

  // Змінити тип або значення конкретного правила
  const changeRule = (index: number, updates: any) => {
    const next = rules.map((r, i) => i === index ? { ...r, ...updates } : r);
    updateRules(next);
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<GitFork size={16} />}
      title="Диспетчер подій"
      bgColor="bg-rose-500"
      type="eventVariationsNode"
      width="w-72"
    >
      {/* Вхідний порт — завжди зліва */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#f43f5e', '20px', mini)}
        className="!left-[-6px]"
      />

      {/* Вихідний порт для кожного правила — генерується динамічно */}
      {rules.map((_: any, index: number) => (
        <Handle
          key={`port_${index}`}
          type="source"
          position={Position.Right}
          id={`port_${index}`}
          style={getHandleStyle(
            TYPE_COLORS[rules[index]?.type] || '#f43f5e',
            mini ? '50%' : `${FIRST_PORT_TOP + index * PORT_STEP}px`,
            mini
          )}
          className="!right-[-6px]"
        />
      ))}

      {/* Вхідні порти для підміни значень правил зівні */}
      {rules.map((_: any, index: number) => (
        <Handle
          key={`in_${index}`}
          type="target"
          position={Position.Left}
          id={`in_${index}`}
          style={getHandleStyle(
            TYPE_COLORS[rules[index]?.type] || '#f43f5e', // Колір порту відповідає типу умови
            mini ? '50%' : `${FIRST_PORT_TOP + index * PORT_STEP}px`, // Розташування по вертикалі
            mini
          )}
          className="!left-[-6px]"
        />
      ))}

      {/* Порт "Нічого не знайдено" — завжди останній */}
      <Handle
        type="source"
        position={Position.Right}
        id="fail"
        style={getHandleStyle(
          '#64748b',
          mini ? '50%' : `${FIRST_PORT_TOP + rules.length * PORT_STEP + 16}px`,
          mini
        )}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Заголовок з кнопкою додавання */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">
              Варіанти (пріоритет: зверху вниз)
            </span>
            <button
              onClick={addRule}
              className="p-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 rounded transition-colors"
              title="Додати варіант"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Список правил */}
          <div className="space-y-2">
            {rules.map((rule: any, index: number) => (
              <div
                key={index}
                className="flex gap-1.5 items-center bg-muted/30 p-1.5 rounded-lg border border-border/50"
              >
                {/* Номер порту — кольоровий, відповідає handle */}
                <div
                  className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                  style={{ backgroundColor: TYPE_COLORS[rule.type] || '#f43f5e' }}
                >
                  {index + 1}
                </div>

                {/* Вибір типу умови */}
                <select
                  value={rule.type}
                  onChange={(e) => changeRule(index, { type: e.target.value })}
                  className="h-7 text-[9px] bg-muted border border-border/50 rounded focus:ring-1 ring-rose-500 outline-none shrink-0"
                  style={{ width: '76px' }}
                >
                  <option value="text">Текст</option>
                  <option value="selector">Селектор</option>
                  <option value="image">Картинка</option>
                </select>

                {/* Поле вводу значення */}
                <Input
                  value={rule.value}
                  onChange={(e) => changeRule(index, { value: e.target.value })}
                  placeholder={
                    rule.type === 'text'     ? 'Текст...' :
                    rule.type === 'image'    ? 'file.png' :
                                               '.css-class'
                  }
                  className="h-7 text-[10px] border-border bg-muted/50 flex-1"
                />

                {/* Прапорець авто-запуску при надходженні через вхід */}
                <label
                  className="flex items-center gap-0.5 cursor-pointer group/zap shrink-0"
                  title="Авто-запуск: при надходженні даних в цей вхід — запустити перевірку автоматично"
                >
                  {/* Чекбокс прапорця */}
                  <input
                    type="checkbox"
                    checked={rule.triggerOnInput || false} // Стан авто-запуску
                    onChange={(e) => changeRule(index, { triggerOnInput: e.target.checked })} // Оновлюємо прапорець
                    className="w-2.5 h-2.5 rounded border-none bg-rose-500/20 text-rose-500 focus:ring-0"
                  />
                  {/* Іконка блискавки — візуально показує стан */}
                  <Zap
                    size={9}
                    className={`transition-colors ${rule.triggerOnInput ? 'text-amber-400' : 'text-muted-foreground group-hover/zap:text-amber-400/50'}`}
                  />
                </label>

                {/* Кнопка видалення */}
                <button
                  onClick={() => removeRule(index)}
                  className="p-1 text-muted-foreground hover:text-rose-400 transition-colors shrink-0"
                  title="Видалити варіант"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Підказка якщо правил немає */}
            {rules.length === 0 && (
              <div className="text-[10px] text-muted-foreground text-center py-3 border-2 border-dashed border-border/40 rounded-lg">
                Натисніть [+] щоб додати варіант
              </div>
            )}
          </div>

          {/* Підпис порту "нічого" */}
          <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-400 pt-1 border-t border-border">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            Нічого не знайдено
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default EventVariationsNode;
