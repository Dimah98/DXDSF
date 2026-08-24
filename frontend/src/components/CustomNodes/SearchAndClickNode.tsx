// Імпортуємо хук memo для оптимізації рендерингу компонента
import { memo } from 'react';
// Імпортуємо компоненти Handle та Position з бібліотеки React Flow для роботи з портами зв'язків
import { Handle, Position } from '@xyflow/react';
// Імпортуємо необхідні іконки з бібліотеки lucide-react
import { MousePointerClick, Info, HelpCircle } from 'lucide-react';
// Імпортуємо базовий компонент ноди та допоміжну функцію для стилізації портів
import BaseNode, { getHandleStyle } from './BaseNode';
// Імпортуємо кастомний компонент текстового поля введення
import { Input } from '../ui/input';

// Створюємо мемоізований компонент нашої нової ноди SearchAndClickNode
const SearchAndClickNode = memo(({ id, data }: any) => {
  // Визначаємо чи згорнута нода у міні-режим
  const mini = data.miniCollapsed;
  // Отримуємо селектор поля введення або задаємо пустий за замовчуванням
  const inputSelector = data.inputSelector || '';
  // Отримуємо текст для введення або пустий рядок
  const textToEnter = data.textToEnter || '';
  // Отримуємо селектор для кліку
  const clickSelector = data.clickSelector || '';
  // Отримуємо затримку перед кліком (за замовчуванням 500мс)
  const clickDelay = data.clickDelay !== undefined ? data.clickDelay : 500;

  // Функція для оновлення конкретного поля в даних ноди
  const handleChange = (field: string, val: any) => {
    // Викликаємо функцію зворотного зв'язку для збереження змін у граф
    data.onDataChange(id, { [field]: val });
  };

  return (
    // Використовуємо базовий каркас ноди з відповідними кольорами та іконкою
    <BaseNode id={id} data={data} icon={<MousePointerClick size={16} />} title="Введення та Клік" bgColor="bg-purple-600" type="searchAndClickNode" width="w-64">
      {/* Вхідний порт для сигналу (зліва) */}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#9333ea', mini ? '50%' : '20px', mini)} className="!left-[-6px]" />
      
      {/* Вихідний порт для успішного виконання (справа, зелений колір) */}
      <Handle type="source" position={Position.Right} id="success" style={getHandleStyle('#22c55e', mini ? '50%' : '20px', mini)} className="!right-[-6px] !bg-green-500" />
      
      {/* Вихідний порт для обробки помилок (знизу або справа зі спеціальним id) */}
      <Handle type="source" position={Position.Right} id="error" style={getHandleStyle('#ef4444', mini ? '50%' : '40px', mini)} className="!right-[-6px] !top-[40px] !bg-red-500" />

      {/* Якщо нода не згорнута, показуємо її вміст */}
      {!mini && (
        <div className="p-3 space-y-3">
          {/* Блок налаштування селектора введення */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">
              Селектор введення (Input):
            </label>
            <Input 
              type="text"
              value={inputSelector}
              onChange={(e) => handleChange('inputSelector', e.target.value)}
              placeholder="напр. input[type='text']"
              className="h-7 text-xs bg-slate-800 border-slate-700 focus:border-purple-500"
            />
          </div>

          {/* Блок налаштування тексту для введення */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">
              Варіанти тексту (кома або новий рядок):
            </label>
            <textarea
              value={textToEnter}
              onChange={(e) => handleChange('textToEnter', e.target.value)}
              placeholder="напр.&#10;chipuha&#10;test&#10;{varName}"
              className="w-full h-20 text-xs bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 outline-none resize-none focus:border-purple-500 transition-colors custom-scrollbar"
            />
          </div>

          {/* Блок налаштування селектора елемента для кліку */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">
              Селектор для кліку:
            </label>
            <Input 
              type="text"
              value={clickSelector}
              onChange={(e) => handleChange('clickSelector', e.target.value)}
              placeholder="напр. div.cursor-pointer"
              className="h-7 text-xs bg-slate-800 border-slate-700 focus:border-purple-500"
            />
          </div>

          {/* Блок налаштування затримки перед кліком */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase px-1 flex items-center gap-1">
              Затримка перед кліком (мс):
              <HelpCircle size={10} className="text-muted-foreground" title="Час очікування після введення тексту перед пошуком елемента" />
            </label>
            <Input 
              type="number"
              value={clickDelay}
              onChange={(e) => handleChange('clickDelay', Number(e.target.value))}
              min={0}
              step={100}
              className="h-7 text-xs bg-slate-800 border-slate-700 focus:border-purple-500"
            />
          </div>

          {/* Інформаційний блок про статус останнього виконання */}
          {data.lastStatus && (
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 text-[10px] space-y-0.5">
              <div className="text-muted-foreground">Останній статус:</div>
              <div className="text-purple-400 font-medium truncate">{data.lastStatus}</div>
              {data.lastTime && <div className="text-[9px] text-slate-500">Час: {data.lastTime}</div>}
            </div>
          )}

          {/* Невелика підказка про те, як працює пошук за текстом */}
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <div className="flex gap-1.5 items-start">
              <Info size={12} className="shrink-0 text-purple-400 mt-0.5" />
              <div className="text-[9px] text-muted-foreground leading-normal">
                Вводить один випадковий варіант із вказаних (розділених комою або новим рядком), чекає вказану затримку, після чого знаходить елемент за другим селектором, який містить цей текст, та натискає на нього. Підтримує глобальні змінні <span className="text-purple-400">{"{varName}"}</span>.
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

// Експортуємо компонент за замовчуванням
export default SearchAndClickNode;
