import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Compass, MapPin, MessageSquare, Timer, Navigation, ChevronDown } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

// Словник відомих NPC для швидкого вибору за локацією
export const KNOWN_NPCS_BY_LOCATION: Record<string, Array<{ id: string; label: string }>> = {
  plaza: [
    { id: 'stella', label: 'Stella (Стелла — Декорації/Магазин)' },
    { id: 'blacksmith', label: 'Blacksmith (Коваль — Інструменти)' },
    { id: 'peggy', label: 'Peggy (Пеггі — Доставка/Завдання)' },
    { id: 'hammerin harry', label: 'Hammerin Harry (Гаррі)' },
    { id: 'poppy', label: 'Poppy (Поппі)' },
    { id: 'mayor', label: 'Mayor (Мер)' },
    { id: 'betty', label: 'Betty (Бетті)' },
    { id: 'chase', label: 'Chase (Чейз)' },
    { id: 'grimbly', label: 'Grimbly (Грімблі)' },
    { id: 'grimtooth', label: 'Grimtooth (Грімтуз)' },
    { id: 'bert', label: 'Bert (Берт)' },
    { id: 'timmy', label: 'Timmy (Тіммі)' },
    { id: 'tywin', label: 'Tywin (Тайвін)' },
    { id: 'garth', label: 'Garth (Гарт)' },
    { id: 'raven', label: 'Raven (Ворон)' },
  ],
  beach: [
    { id: 'corale', label: 'Corale (Коралі — Пляжні скарби)' },
    { id: 'miranda', label: 'Miranda (Міранда)' },
    { id: 'digby', label: 'Digby (Дігбі — Знахідки)' },
    { id: 'pharaoh', label: 'Pharaoh (Фараон)' },
    { id: 'petro', label: 'Petro (Петро)' },
    { id: 'old salty', label: 'Old Salty (Старий Солті)' },
    { id: 'finn', label: 'Finn (Фінн — Риболовля)' },
    { id: 'finley', label: 'Finley (Фінлі)' },
    { id: 'tango', label: 'Tango (Танго)' },
    { id: 'jafar', label: 'Jafar (Джафар)' },
  ],
  retreat: [
    { id: 'gordon', label: 'Gordon (Гордон)' },
    { id: 'elmer', label: 'Elmer (Елмер)' },
    { id: 'felix', label: 'Felix (Фелікс)' },
    { id: 'billy', label: 'Billy (Біллі)' },
  ],
  kingdom: [
    { id: 'king', label: 'King (Король)' },
    { id: 'guard', label: 'Guard (Охоронець)' },
  ]
};

const ALL_POPULAR_NPCS: Array<{ id: string; label: string }> = [
  ...KNOWN_NPCS_BY_LOCATION.plaza,
  ...KNOWN_NPCS_BY_LOCATION.beach,
  ...KNOWN_NPCS_BY_LOCATION.retreat
];

const WorldNavigatorNode = memo(({ id, data }: { id: string; data: any }) => {
  const mini = data.miniCollapsed;
  const targetLocation = data.targetLocation || 'current';
  const targetNpc = data.targetNpc || 'stella';
  const customNpcName = data.customNpcName || '';
  const customCoords = data.customCoords || { x: 0, y: 0 };
  const autoInteract = data.autoInteract !== false;
  const interactionDistance = typeof data.interactionDistance === 'number' ? data.interactionDistance : 35;
  const timeoutSeconds = typeof data.timeoutSeconds === 'number' ? data.timeoutSeconds : 35;

  const update = (patch: Record<string, any>) => {
    if (typeof data.onDataChange === 'function') {
      data.onDataChange(id, patch);
    }
  };

  // Отримуємо доступних NPC для обраної локації
  const npcList = (targetLocation in KNOWN_NPCS_BY_LOCATION)
    ? KNOWN_NPCS_BY_LOCATION[targetLocation]
    : ALL_POPULAR_NPCS;

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Compass size={16} />}
      title={data.label || 'Навігатор до NPC'}
      bgColor="bg-indigo-600"
      type="worldNavigatorNode"
      width="w-80"
    >
      {/* Вхідний порт */}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle('#eab308', '20px', mini)}
        className="!left-[-6px]"
      />
      {/* Вихід: успішно дійшов до NPC */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={getHandleStyle('#22c55e', mini ? '50%' : '35%', mini)}
        className="!right-[-6px]"
      />
      {/* Вихід: помилка / не знайдено / таймаут */}
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={getHandleStyle('#ef4444', mini ? '50%' : '65%', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3 text-xs text-gray-200">
          {/* Локація відкритого світу */}
          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 flex items-center gap-1">
              <Navigation size={12} className="text-indigo-400" />
              Локація світу
            </label>
            <div className="relative">
              <select
                value={targetLocation}
                onChange={(e) => update({ targetLocation: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-100 appearance-none focus:outline-none focus:border-indigo-500 pr-7 cursor-pointer"
              >
                <option value="current">📍 Поточна локація (де зараз бот)</option>
                <option value="plaza">🏛️ Плаза (/#/world/plaza)</option>
                <option value="beach">🏖️ Пляж (/#/world/beach)</option>
                <option value="retreat">⛺ Притулок (/#/world/retreat)</option>
                <option value="kingdom">🏰 Королівство (/#/world/kingdom)</option>
                <option value="custom">🌐 Власна URL-адреса...</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
            </div>

            {targetLocation === 'custom' && (
              <input
                type="text"
                value={data.customLocationUrl || ''}
                onChange={(e) => update({ customLocationUrl: e.target.value })}
                placeholder="https://sunflower-land.com/play/#/world/..."
                className="mt-1.5 w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>

          {/* Цільовий NPC */}
          <div>
            <label className="text-[11px] font-medium text-gray-400 mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-emerald-400" />
              Цільовий NPC / Об'єкт
            </label>
            <div className="relative">
              <select
                value={targetNpc}
                onChange={(e) => update({ targetNpc: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-100 appearance-none focus:outline-none focus:border-indigo-500 pr-7 cursor-pointer"
              >
                <optgroup label="Відомі NPC">
                  {npcList.map((npc) => (
                    <option key={npc.id} value={npc.id}>
                      {npc.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Користувацькі">
                  <option value="custom">✏️ Власне ім'я NPC...</option>
                  <option value="coords">📐 Точні координати (X, Y)...</option>
                </optgroup>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
            </div>

            {targetNpc === 'custom' && (
              <div className="mt-1.5">
                <input
                  type="text"
                  value={customNpcName}
                  onChange={(e) => update({ customNpcName: e.target.value })}
                  placeholder="Введіть ключ або ім'я NPC (напр. stella, blacksmith)"
                  className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {targetNpc === 'coords' && (
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <div>
                  <span className="text-[10px] text-gray-400 block mb-0.5">X (пікселі)</span>
                  <input
                    type="number"
                    value={customCoords.x}
                    onChange={(e) => update({ customCoords: { ...customCoords, x: Number(e.target.value) } })}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block mb-0.5">Y (пікселі)</span>
                  <input
                    type="number"
                    value={customCoords.y}
                    onChange={(e) => update({ customCoords: { ...customCoords, y: Number(e.target.value) } })}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Взаємодія з NPC */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-950/60 p-2 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={autoInteract}
                onChange={(e) => update({ autoInteract: e.target.checked })}
                className="rounded border-gray-700 bg-gray-900 text-indigo-500 focus:ring-0 cursor-pointer h-3.5 w-3.5"
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-200 flex items-center gap-1">
                  <MessageSquare size={12} className="text-indigo-400" />
                  Відкрити діалог / магазин (Взаємодія)
                </span>
                <span className="text-[10px] text-gray-400 leading-tight">
                  Після наближення клікне по NPC та натисне Space
                </span>
              </div>
            </label>
          </div>

          {/* Додаткові параметри: таймаут та дистанція */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800/80">
            <div>
              <label className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                <Timer size={10} className="text-amber-400" />
                Таймаут (сек)
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={timeoutSeconds}
                onChange={(e) => update({ timeoutSeconds: Math.max(10, Number(e.target.value)) })}
                className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                <MapPin size={10} className="text-emerald-400" />
                Дистанція (px)
              </label>
              <input
                type="number"
                min={15}
                max={80}
                value={interactionDistance}
                onChange={(e) => update({ interactionDistance: Math.max(15, Number(e.target.value)) })}
                className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default WorldNavigatorNode;
