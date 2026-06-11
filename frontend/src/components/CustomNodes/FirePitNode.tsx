import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Flame, ChevronDown, ChevronRight, Check } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';
import { Input } from '../ui/input';

// Словник страв для відображення в UI
const RECIPES_DATA: Record<string, Record<string, number>> = {
  "Furikake Sprinkle": { "Fish Flake": 1, "Seaweed": 1 },
  "Mashed Potato": { "Potato": 8 },
  "Pumpkin Soup": { "Pumpkin": 10 },
  "Reindeer Carrot": { "Carrot": 5 },
  "Mushroom Soup": { "Wild Mushroom": 5 },
  "Popcorn": { "Sunflower": 100, "Corn": 5 },
  "Bumpkin Broth": { "Carrot": 10, "Cabbage": 5 },
  "Cabbers n Mash": { "Mashed Potato": 10, "Cabbage": 20 },
  "Boiled Eggs": { "Egg": 10 },
  "Kale Stew": { "Kale": 10 },
  "Kale Omelette": { "Egg": 40, "Kale": 5 },
  "Gumbo": { "Potato": 50, "Pumpkin": 30, "Carrot": 20, "Red Snapper": 3 },
  "Rapid Roast": { "Magic Mushroom": 1, "Pumpkin": 40 },
  "Fried Tofu": { "Soybean": 15, "Sunflower": 200 },
  "Rice Bun": { "Rice": 2, "Wheat": 50 },
  "Antipasto": { "Olive": 2, "Grape": 2 },
  "Pizza Margherita": { "Tomato": 30, "Cheese": 5, "Wheat": 20 },
  "Rhubarb Tart": { "Rhubarb": 3 }
};

interface FirePitRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
  selector: string;
}

const FirePitNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const rules: FirePitRule[] = data.rules || [];
  
  // Local state for expanding/collapsing recipe settings
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});

  const toggleExpand = (recipeName: string) => {
    setExpandedRecipes(prev => ({
      ...prev,
      [recipeName]: !prev[recipeName]
    }));
  };

  const handleChange = (field: string, val: any) => {
    data.onDataChange(id, { [field]: val });
  };

  const updateRule = (index: number, field: keyof FirePitRule, val: any) => {
    const updated = rules.map((r, i) =>
      i === index ? { ...r, [field]: val } : r
    );
    handleChange('rules', updated);
  };

  const updateIngMultiplier = (index: number, ingName: string, val: number) => {
    const updated = rules.map((r, i) => {
      if (i !== index) return r;
      return {
        ...r,
        ingMultipliers: {
          ...(r.ingMultipliers || {}),
          [ingName]: val
        }
      };
    });
    handleChange('rules', updated);
  };

  return (
    <BaseNode
      id={id}
      data={data}
      icon={<Flame size={16} />}
      title="Шеф Fire Pit"
      bgColor="#ea580c"
      type="firePitNode"
      width="w-[320px]"
    >
      {/* Вхідний порт зліва */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={getHandleStyle('#ea580c', mini ? '50%' : '20px', mini)}
        className="!left-[-6px]"
      />

      {/* Вихід "Готувати" — правий зелений порт */}
      <Handle
        type="source"
        position={Position.Right}
        id="cook"
        style={getHandleStyle('#22c55e', mini ? '50%' : '30px', mini)}
        className="!right-[-6px]"
      />

      {/* Вихід "Пропустити" — правий синій порт */}
      <Handle
        type="source"
        position={Position.Right}
        id="skip"
        style={getHandleStyle('#3b82f6', mini ? '50%' : '60px', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3">
          {/* Підписи виходів */}
          <div className="flex flex-col gap-1 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-green-400 font-medium">✅ Готувати першу підходящу</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
              <span className="text-sky-400 font-medium">⏭️ Пропустити (немає умов)</span>
            </div>
          </div>

          <div className="bg-muted/30 p-2 rounded-lg border border-border/50 space-y-2">
            <div className="text-[10px] font-bold text-orange-400 uppercase mb-2">Список страв (всі 18)</div>
            
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {rules.map((rule, i) => {
                const recipeBase = RECIPES_DATA[rule.recipeName];
                if (!recipeBase) return null;
                
                const isExpanded = expandedRecipes[rule.recipeName];
                
                return (
                  <div key={rule.recipeName} className={`rounded border transition-colors ${rule.enabled ? 'bg-slate-800/80 border-orange-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                    
                    {/* Header: Title and Toggle */}
                    <div className="flex items-center justify-between p-2">
                      <div 
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => toggleExpand(rule.recipeName)}
                      >
                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span className={`text-[11px] font-medium ${rule.enabled ? 'text-orange-100' : 'text-slate-500'}`}>
                          {rule.recipeName}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-2">
                        {rule.enabled && <Check size={12} className="text-green-500" />}
                        <input 
                          type="checkbox"
                          checked={rule.enabled} 
                          onChange={(e) => updateRule(i, 'enabled', e.target.checked)}
                          className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Body: Settings (Visible when expanded) */}
                    {isExpanded && (
                      <div className="p-2 pt-0 space-y-2 border-t border-slate-700/50 mt-1">
                        
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[10px] text-slate-400">Макс. страв:</span>
                          <Input
                            type="number"
                            min={0}
                            value={rule.maxDish}
                            onChange={(e) => updateRule(i, 'maxDish', Number(e.target.value) || 0)}
                            className="h-6 w-16 text-[10px] bg-slate-900 border-slate-700 px-2 text-center"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400">Множники інгредієнтів:</span>
                          <div className="bg-slate-900/50 rounded p-1.5 space-y-1.5 border border-slate-800">
                            {Object.entries(recipeBase).map(([ing, baseQty]) => {
                              const mult = rule.ingMultipliers?.[ing] ?? 1;
                              const required = baseQty * mult;
                              return (
                                <div key={ing} className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] text-slate-300 w-24 truncate">{ing} <span className="text-slate-500">(x{baseQty})</span></span>
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={mult}
                                      onChange={(e) => updateIngMultiplier(i, ing, Number(e.target.value) || 0)}
                                      className="h-5 w-12 text-[9px] bg-slate-800 border-slate-700 px-1 text-center"
                                    />
                                    <span className="text-[9px] font-mono text-orange-300 w-8 text-right">={required}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 pt-1">
                          <span className="text-[9px] text-slate-400">CSS Селектор:</span>
                          <Input
                            type="text"
                            value={rule.selector}
                            onChange={(e) => updateRule(i, 'selector', e.target.value)}
                            placeholder={`#fire-pit-${rule.recipeName.toLowerCase().replace(/\s+/g, '-')}`}
                            className="h-6 text-[10px] bg-slate-900 border-slate-700 px-2 font-mono"
                          />
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
});

export default FirePitNode;
