import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Move } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

interface IslandArrangerNodeProps {
  data: {
    label: string;
    filterType?: string;
    step1Selector?: string;
    step3Selector?: string;
    step6Selector?: string;
    step7Selector?: string;
    step8Selector?: string;
    step9Selector?: string;
    step10Selector?: string;
    editModeSelector?: string; // Legacy
    tileSize?: number;
    miniCollapsed?: boolean;
    onDataChange?: (id: string, data: any) => void;
  };
  id: string;
}

const IslandArrangerNode = ({ data, id }: IslandArrangerNodeProps) => {
  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Move size={16} />}
      title={data.label || 'Дизайнер Острова'}
      bgColor="#eab308" // yellow-500
      type="islandArrangerNode"
      width="w-64"
    >
      <div className="p-4 space-y-4">
        {/* Опис / Контроли */}
        <div className="text-[10px] text-gray-400">
          Автоматично розставить будівлі згідно збереженої Карти Острова.
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-medium text-gray-300">Що переміщувати:</label>
          <select 
            value={data.filterType || 'all'} 
            onChange={(e) => data.onDataChange?.(id, { filterType: e.target.value })}
            className="w-full bg-[#1e293b] text-gray-300 text-xs px-2 py-1.5 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308] hover:border-gray-500 transition-colors"
          >
            <option value="all">Все, що змінено на карті</option>
            <option value="crops">Тільки грядки (Crops)</option>
            <option value="buildings">Тільки будівлі</option>
            <option value="collectibles">Тільки декорації (Collectibles)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-medium text-gray-300">Алгоритм розміщення (кроки):</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={data.step1Selector || data.editModeSelector || ''}
              onChange={(e) => data.onDataChange?.(id, { step1Selector: e.target.value })}
              placeholder='Крок 1 (селектор)'
              title='1 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
            <input
              type="text"
              value={data.step3Selector || ''}
              onChange={(e) => data.onDataChange?.(id, { step3Selector: e.target.value })}
              placeholder='Крок 3 (селектор)'
              title='3 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
            <input
              type="text"
              value={data.step6Selector || ''}
              onChange={(e) => data.onDataChange?.(id, { step6Selector: e.target.value })}
              placeholder='Крок 6 (селектор)'
              title='6 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
            <input
              type="text"
              value={data.step7Selector || ''}
              onChange={(e) => data.onDataChange?.(id, { step7Selector: e.target.value })}
              placeholder='Крок 7 (селектор)'
              title='7 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
            <input
              type="text"
              value={data.step8Selector || ''}
              onChange={(e) => data.onDataChange?.(id, { step8Selector: e.target.value })}
              placeholder='Крок 8 (селектор)'
              title='8 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
            <input
              type="text"
              value={data.step9Selector || ''}
              onChange={(e) => data.onDataChange?.(id, { step9Selector: e.target.value })}
              placeholder='Крок 9 (селектор)'
              title='9 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
            <input
              type="text"
              value={data.step10Selector || ''}
              onChange={(e) => data.onDataChange?.(id, { step10Selector: e.target.value })}
              placeholder='Крок 10 (селектор)'
              title='10 клік по селектору'
              className="w-full bg-[#1e293b] text-gray-300 text-[10px] px-2 py-1 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-medium text-gray-300">Розмір клітинки в грі (px):</label>
          <input
            type="number"
            value={data.tileSize || 40}
            onChange={(e) => data.onDataChange?.(id, { tileSize: parseInt(e.target.value) || 40 })}
            className="w-full bg-[#1e293b] text-gray-300 text-xs px-2 py-1.5 rounded-md border border-gray-600 focus:outline-none focus:border-[#eab308] transition-colors"
          />
        </div>
      </div>

      {/* Порти (Вхід та Вихід) */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#eab308', '20px', data.miniCollapsed)}
        className="!left-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '35%', data.miniCollapsed)}
        className="!right-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '65%', data.miniCollapsed)}
        className="!right-[-6px]"
      />
    </BaseNode>
  );
};

export default memo(IslandArrangerNode);
