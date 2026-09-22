import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Hammer, Image, Crosshair, CheckCircle2, Save } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

interface BuildingPlacerNodeProps {
  data: {
    label: string;
    shopImage?: string;
    categoryImage?: string;
    buildingImage?: string;
    craftButtonSelector?: string;
    craftButtonImage?: string;
    buildingName?: string;
    targetX?: number;
    targetY?: number;
    confirmImage1?: string;
    confirmImage2?: string;
    saveButtonSelector?: string;
    saveButtonImage?: string;
    stepDelayMs?: number;
    miniCollapsed?: boolean;
    onDataChange?: (id: string, data: any) => void;
  };
  id: string;
}

const POPULAR_BUILDINGS = [
  { name: 'Kitchen', shop: 'workbench', cat: 'hammer', img: 'kitchen' },
  { name: 'Water Well', shop: 'workbench', cat: 'hammer', img: 'water_well' },
  { name: 'Hen House', shop: 'workbench', cat: 'hammer', img: 'hen_house' },
  { name: 'Bakery', shop: 'workbench', cat: 'hammer', img: 'bakery' },
  { name: 'Deli', shop: 'workbench', cat: 'hammer', img: 'deli' },
  { name: 'Barn', shop: 'workbench', cat: 'hammer', img: 'barn' },
  { name: 'Smoothie Shack', shop: 'workbench', cat: 'hammer', img: 'smoothie_shack' },
  { name: 'Toolshed', shop: 'workbench', cat: 'hammer', img: 'toolshed' },
  { name: 'Warehouse', shop: 'workbench', cat: 'hammer', img: 'warehouse' },
  { name: 'Compost Bin', shop: 'workbench', cat: 'hammer', img: 'compost_bin' },
  { name: 'Turbo Composter', shop: 'workbench', cat: 'hammer', img: 'turbo_composter' },
  { name: 'Premium Composter', shop: 'workbench', cat: 'hammer', img: 'premium_composter' },
  { name: 'Greenhouse', shop: 'workbench', cat: 'hammer', img: 'greenhouse' },
  { name: 'Crop Machine', shop: 'workbench', cat: 'hammer', img: 'crop_machine' },
  { name: 'Crafting Box', shop: 'workbench', cat: 'hammer', img: 'crafting_box' },
  { name: 'Basic Scarecrow', shop: 'workbench', cat: 'hammer', img: 'scarecrow' },
  { name: 'Scary Mike', shop: 'workbench', cat: 'hammer', img: 'scary_mike' },
  { name: 'Laurie the Chuckle Crow', shop: 'workbench', cat: 'hammer', img: 'laurie' },
  { name: 'Immortal Pear', shop: 'workbench', cat: 'hammer', img: 'immortal_pear' },
  { name: 'Bale', shop: 'workbench', cat: 'hammer', img: 'bale' },
];

const BuildingPlacerNode = ({ data, id }: BuildingPlacerNodeProps) => {
  const updateField = (field: string, val: any) => {
    data.onDataChange?.(id, { [field]: val });
  };

  const handleSelectBuilding = (val: string) => {
    if (!val) {
      data.onDataChange?.(id, {
        buildingName: '',
        shopImage: data.shopImage || 'workbench',
        categoryImage: data.categoryImage || 'hammer',
        buildingImage: ''
      });
    } else {
      const found = POPULAR_BUILDINGS.find(b => b.name.toLowerCase() === val.toLowerCase());
      data.onDataChange?.(id, {
        buildingName: val,
        shopImage: found?.shop || 'workbench',
        categoryImage: found?.cat || 'hammer',
        buildingImage: found?.img || val.toLowerCase().replace(/ /g, '_')
      });
    }
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Hammer size={16} />}
      title={data.label || 'Розміщення Будівлі'}
      bgColor="#f59e0b"
      type="buildingPlacerNode"
      width="w-72"
    >
      <div className="p-3 space-y-3 text-xs">
        <div className="text-[10px] text-gray-400">
          Автоматичне відкриття верстака, перехід у вкладку Build, покупка та розміщення на координати острова.
        </div>

        {/* Швидкий вибір будівлі */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Hammer size={11} /> Будівля для розміщення:
          </label>
          <select
            value={data.buildingName || ''}
            onChange={(e) => handleSelectBuilding(e.target.value)}
            className="w-full bg-[#1e293b] text-gray-200 text-[11px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">✨ Автоматично з макету карти (рекомендовано)</option>
            {POPULAR_BUILDINGS.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* 1. Магазин */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Image size={11} /> 1. Зображення магазину / верстака:
          </label>
          <input
            type="text"
            value={data.shopImage || ''}
            onChange={(e) => updateField('shopImage', e.target.value)}
            placeholder="workbench (або назва картинки)"
            className="w-full bg-[#1e293b] text-gray-200 text-[11px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* 2. Категорія */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Image size={11} /> 2. Зображення категорії:
          </label>
          <input
            type="text"
            value={data.categoryImage || ''}
            onChange={(e) => updateField('categoryImage', e.target.value)}
            placeholder="hammer (вкладка Build)"
            className="w-full bg-[#1e293b] text-gray-200 text-[11px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* 3. Будівля в магазині */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Image size={11} /> 3. Зображення будівлі:
          </label>
          <input
            type="text"
            value={data.buildingImage || ''}
            onChange={(e) => updateField('buildingImage', e.target.value)}
            placeholder="kitchen (авто за назвою)"
            className="w-full bg-[#1e293b] text-gray-200 text-[11px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* 4. Кнопка Craft */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Crosshair size={11} /> 4. Кнопка Craft / Build:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={data.craftButtonSelector ?? 'button:has-text("Build")'}
              onChange={(e) => updateField('craftButtonSelector', e.target.value)}
              placeholder="Селектор"
              className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={data.craftButtonImage || ''}
              onChange={(e) => updateField('craftButtonImage', e.target.value)}
              placeholder="Картинка (опц)"
              className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* 5. Координати розміщення */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Crosshair size={11} /> 5. Координати розміщення на острові:
          </label>
          <input
            type="text"
            value={data.buildingName || ''}
            onChange={(e) => updateField('buildingName', e.target.value)}
            placeholder="Назва будівлі (порожньо = авто з макету)"
            className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 mb-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-gray-400">X (ручний):</span>
              <input
                type="number"
                value={data.targetX ?? ''}
                onChange={(e) => updateField('targetX', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                placeholder="З макету"
                className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <span className="text-[9px] text-gray-400">Y (ручний):</span>
              <input
                type="number"
                value={data.targetY ?? ''}
                onChange={(e) => updateField('targetY', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                placeholder="З макету"
                className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* 6 & 7. Підтвердження 1 і 2 */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <CheckCircle2 size={11} /> 6 & 7. Підтвердження (2 картинки):
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={data.confirmImage1 || ''}
              onChange={(e) => updateField('confirmImage1', e.target.value)}
              placeholder="Картинка 1"
              className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={data.confirmImage2 || ''}
              onChange={(e) => updateField('confirmImage2', e.target.value)}
              placeholder="Картинка 2"
              className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* 8. Кнопка Зберегти */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <Save size={11} /> 8. Кнопка Save:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={data.saveButtonSelector ?? 'button:has-text("Save")'}
              onChange={(e) => updateField('saveButtonSelector', e.target.value)}
              placeholder="Селектор"
              className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={data.saveButtonImage || ''}
              onChange={(e) => updateField('saveButtonImage', e.target.value)}
              placeholder="Картинка (опц)"
              className="w-full bg-[#1e293b] text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Затримка між кроками */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-gray-400">Пауза між кроками (мс):</span>
          <input
            type="number"
            value={data.stepDelayMs ?? 1000}
            onChange={(e) => updateField('stepDelayMs', parseInt(e.target.value) || 1000)}
            className="w-16 bg-[#1e293b] text-gray-200 text-[10px] px-1.5 py-0.5 rounded border border-gray-700 focus:outline-none text-right"
          />
        </div>
      </div>

      {/* Порти */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#f59e0b', '20px', data.miniCollapsed)}
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

export default memo(BuildingPlacerNode);
