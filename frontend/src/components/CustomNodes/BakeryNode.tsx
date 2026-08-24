import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChefHat, ChevronDown, ChevronRight, Check } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';
import { Input } from '../ui/input';

export const BAKERY_RECIPES_DATA: Record<string, Record<string, number>> = {
  "Lemon Cheesecake": { "Lemon": 20, "Cheese": 5, "Egg": 40 },
  "Honey Cake": { "Honey": 10, "Wheat": 10, "Egg": 20 },
  "Orange Cake": { "Orange": 5, "Egg": 30, "Wheat": 10 },
  "Apple Pie": { "Apple": 5, "Wheat": 10, "Egg": 20 },
  "Kale & Mushroom Pie": { "Wild Mushroom": 10, "Kale": 5, "Wheat": 5 },
  "Sunflower Cake": { "Sunflower": 1000, "Wheat": 10, "Egg": 30 },
  "Potato Cake": { "Potato": 500, "Wheat": 10, "Egg": 30 },
  "Pumpkin Cake": { "Pumpkin": 130, "Wheat": 10, "Egg": 30 },
  "Eggplant Cake": { "Eggplant": 30, "Wheat": 10, "Egg": 30 },
  "Carrot Cake": { "Carrot": 120, "Wheat": 10, "Egg": 30 },
  "Cabbage Cake": { "Cabbage": 90, "Wheat": 10, "Egg": 30 },
  "Beetroot Cake": { "Beetroot": 100, "Wheat": 10, "Egg": 30 },
  "Parsnip Cake": { "Parsnip": 45, "Wheat": 10, "Egg": 30 },
  "Cauliflower Cake": { "Cauliflower": 60, "Wheat": 10, "Egg": 30 },
  "Cornbread": { "Corn": 15, "Wheat": 5, "Egg": 10 },
  "Radish Cake": { "Radish": 25, "Wheat": 10, "Egg": 30 },
  "Wheat Cake": { "Wheat": 35, "Egg": 30 }
};

interface BakeryRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
}

const BakeryNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const rules: BakeryRule[] = data.rules || [];
  
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

  const updateRule = (index: number, field: keyof BakeryRule, val: any) => {
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
      icon={<ChefHat size={16} />}
      title="Шеф Bakery"
      bgColor="#f59e0b" // Помаранчевий для Bakery
      type="bakeryNode"
      width="w-[320px]"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={getHandleStyle('#f59e0b', mini ? '50%' : '20px', mini)}
        className="!left-[-6px]"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="cook"
        style={getHandleStyle('#22c55e', mini ? '50%' : '30px', mini)}
        className="!right-[-6px]"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="skip"
        style={getHandleStyle('#3b82f6', mini ? '50%' : '60px', mini)}
        className="!right-[-6px]"
      />

      {!mini && (
        <div className="p-3 space-y-3">
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
            <div className="text-[10px] font-bold text-amber-400 uppercase mb-2">Список випічки ({Object.keys(BAKERY_RECIPES_DATA).length})</div>
            
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {rules.map((rule, i) => {
                const recipeBase = BAKERY_RECIPES_DATA[rule.recipeName];
                if (!recipeBase) return null;
                
                const isExpanded = expandedRecipes[rule.recipeName];
                
                return (
                  <div key={rule.recipeName} className={`rounded border transition-colors ${rule.enabled ? 'bg-slate-800/80 border-amber-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                    
                    <div className="flex items-center justify-between p-2">
                      <div 
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => toggleExpand(rule.recipeName)}
                      >
                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span className={`text-[11px] font-medium ${rule.enabled ? 'text-amber-100' : 'text-slate-500'}`}>
                          {rule.recipeName}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-2">
                        {rule.enabled && <Check size={12} className="text-green-500" />}
                        <input 
                          type="checkbox"
                          checked={rule.enabled} 
                          onChange={(e) => updateRule(i, 'enabled', e.target.checked)}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-2 pt-0 space-y-2 border-t border-slate-700/50 mt-1">
                        
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[10px] text-slate-400">Макс. випічки:</span>
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
                                    <span className="text-[9px] font-mono text-amber-300 w-8 text-right">={required}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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

export default BakeryNode;
