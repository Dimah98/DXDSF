import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PackageCheck, Plus, Trash2, RefreshCw } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

interface DeliveryConfig {
  name: string;
  image: string;
  enabled: boolean;
}

interface DeliveryNodeProps {
  data: {
    label: string;
    deliveries?: DeliveryConfig[];
    step2Selector?: string;
    step3Selector?: string;
    miniCollapsed?: boolean;
    onDataChange?: (id: string, data: any) => void;
  };
  id: string;
}

const DIMAH_DELIVERIES: DeliveryConfig[] = [
  { name: 'betty', image: '', enabled: true },
  { name: 'blacksmith', image: '', enabled: true },
  { name: 'bert', image: '', enabled: true },
  { name: 'corale', image: '', enabled: true },
  { name: 'cornwell', image: '', enabled: true },
  { name: 'finley', image: '', enabled: true },
  { name: 'finn', image: '', enabled: true },
  { name: 'gambit', image: '', enabled: true },
  { name: 'gordo', image: '', enabled: true },
  { name: 'grimbly', image: '', enabled: true },
  { name: 'grimtooth', image: '', enabled: true },
  { name: 'grubnuk', image: '', enabled: true },
  { name: 'jester', image: '', enabled: true },
  { name: 'miranda', image: '', enabled: true },
  { name: 'old salty', image: '', enabled: true },
  { name: 'peggy', image: '', enabled: true },
  { name: 'pharaoh', image: '', enabled: true },
  { name: "pumpkin' pete", image: '', enabled: true },
  { name: 'raven', image: '', enabled: true },
  { name: 'tango', image: '', enabled: true },
  { name: 'timmy', image: '', enabled: true },
  { name: 'tywin', image: '', enabled: true },
  { name: 'victoria', image: '', enabled: true }
];

const DeliveryNode = ({ data, id }: DeliveryNodeProps) => {
  const deliveries: DeliveryConfig[] = data.deliveries || DIMAH_DELIVERIES;

  const addDelivery = () => {
    data.onDataChange?.(id, {
      deliveries: [...deliveries, { name: '', image: '', enabled: true }]
    });
  };

  const fillDimahDeliveries = () => {
    data.onDataChange?.(id, {
      deliveries: DIMAH_DELIVERIES
    });
  };

  const removeDelivery = (index: number) => {
    const updated = deliveries.filter((_, i) => i !== index);
    data.onDataChange?.(id, { deliveries: updated });
  };

  const updateDelivery = (index: number, field: keyof DeliveryConfig, value: any) => {
    const updated = deliveries.map((d, i) => i === index ? { ...d, [field]: value } : d);
    data.onDataChange?.(id, { deliveries: updated });
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<PackageCheck size={16} />}
      title={data.label || 'Доставки'}
      bgColor="#0ea5e9"
      type="deliveryNode"
      width="w-96"
    >
      <div className="p-4 space-y-3">
        <div className="text-[10px] text-gray-400">
          Перевіряє відмічені доставки в проекті та виконує дії для кожної.
        </div>

        {/* Список доставок */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-gray-300">Доставки (Назва ➔ Зображення):</label>
            <div className="flex items-center gap-2">
              <button
                onClick={fillDimahDeliveries}
                title="Заповнити список усіма доставками з проекту Dimah"
                className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
              >
                <RefreshCw size={10} />
                З Dimah
              </button>
              <button
                onClick={addDelivery}
                className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Plus size={10} />
                Додати
              </button>
            </div>
          </div>

          {deliveries.length === 0 && (
            <div className="text-[10px] text-gray-500 italic px-1">
              Немає доставок. Натисніть "Додати" або "З Dimah".
            </div>
          )}

          <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
            {deliveries.map((delivery, index) => (
              <div key={index} className="flex items-center gap-1.5 bg-[#161d2a] px-2 py-1.5 rounded-md border border-gray-700">
                <input
                  type="checkbox"
                  checked={delivery.enabled}
                  onChange={(e) => updateDelivery(index, 'enabled', e.target.checked)}
                  title="Ввімкнути/вимкнути цю доставку"
                  className="w-3.5 h-3.5 accent-sky-500 cursor-pointer flex-shrink-0"
                />
                <input
                  type="text"
                  value={delivery.name || ''}
                  onChange={(e) => updateDelivery(index, 'name', e.target.value)}
                  placeholder="Назва"
                  title="Назва доставки / мітка з проекту (напр. betty)"
                  className="w-28 bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-sky-500 flex-shrink-0"
                />
                <span className="text-[10px] text-gray-400 flex-shrink-0">➔</span>
                <input
                  type="text"
                  value={delivery.image || ''}
                  onChange={(e) => updateDelivery(index, 'image', e.target.value)}
                  placeholder="Зображення (напр. bettyP.png)"
                  title="Файл зображення для кліку (напр. bettyP.png)"
                  className="flex-1 bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-sky-500 min-w-0"
                />
                <button
                  onClick={() => removeDelivery(index)}
                  title="Видалити"
                  className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0 ml-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Роздільник */}
        <div className="border-t border-gray-700" />

        {/* Селектор кроку 2 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-gray-300">
            Крок 2 — Селектор (після кліку на зображення):
          </label>
          <input
            type="text"
            value={data.step2Selector || ''}
            onChange={(e) => data.onDataChange?.(id, { step2Selector: e.target.value })}
            placeholder="CSS-селектор кроку 2"
            className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Селектор кроку 3 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-gray-300">
            Крок 3 — Селектор (зняти відмітку, опціонально):
          </label>
          <input
            type="text"
            value={data.step3Selector || ''}
            onChange={(e) => data.onDataChange?.(id, { step3Selector: e.target.value })}
            placeholder="CSS-селектор кроку 3 (якщо пусто — відмітка не знімається)"
            className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-sky-500"
          />
          <div className="text-[9px] text-gray-500">
            Якщо не вказано — відмітка залишається, але наступна доставка все одно буде оброблена.
          </div>
        </div>
      </div>

      {/* Вхід та Виходи */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#0ea5e9', '20px', data.miniCollapsed)}
        className="!left-[-6px]"
      />
      <Handle type="source" position={Position.Right} id="success" style={{ ...getHandleStyle('success'), top: '30%' }} />
      <Handle type="source" position={Position.Right} id="no_deliveries" style={{ ...getHandleStyle('skip'), top: '60%' }} />
      <Handle type="source" position={Position.Right} id="error" style={{ ...getHandleStyle('error'), top: '90%' }} />
    </BaseNode>
  );
};

export default memo(DeliveryNode);
