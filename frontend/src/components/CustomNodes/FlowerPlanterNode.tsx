import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Flower, ChevronDown, ChevronRight, Check, MousePointer, Eye, EyeOff, Settings2 } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';
import { Input } from '../ui/input';

// ── Дані квіток ──────────────────────────────────────────────────────────────
const FLOWER_RECIPES: Record<string, { seed: string; resources: string[] }> = {
  "Red Pansy":    { seed: "Sunpetal Seed", resources: ["Radish","Banana","Red Cosmos","Purple Daffodil","Red Balloon Flower","Red Lotus","Primula Enigma"] },
  "Yellow Pansy": { seed: "Sunpetal Seed", resources: ["Sunflower","Apple","Red Pansy","Red Daffodil","Yellow Balloon Flower","Yellow Carnation"] },
  "Purple Pansy": { seed: "Sunpetal Seed", resources: ["Blue Pansy","Purple Balloon Flower","Purple Carnation"] },
  "White Pansy":  { seed: "Sunpetal Seed", resources: ["Yellow Cosmos"] },
  "Blue Pansy":   { seed: "Sunpetal Seed", resources: ["Purple Cosmos","White Pansy","White Cosmos","White Daffodil","Blue Daffodil","White Carnation"] },
  "Red Cosmos":   { seed: "Sunpetal Seed", resources: ["Yellow Daffodil","Purple Lotus"] },
  "Yellow Cosmos":{ seed: "Sunpetal Seed", resources: ["Yellow Pansy","White Balloon Flower","Red Carnation"] },
  "Purple Cosmos":{ seed: "Sunpetal Seed", resources: ["Beetroot","Eggplant","Kale","Blue Cosmos","Blue Balloon Flower","Celestial Frostbloom"] },
  "White Cosmos": { seed: "Sunpetal Seed", resources: ["Prism Petal","Yellow Lotus"] },
  "Blue Cosmos":  { seed: "Sunpetal Seed", resources: ["Cauliflower","Parsnip","Blueberry","Purple Pansy","White Lotus","Blue Carnation"] },
  "Prism Petal":  { seed: "Sunpetal Seed", resources: ["Blue Lotus"] },
  "Red Balloon Flower":    { seed: "Bloom Seed", resources: ["Sunflower","Beetroot","Apple","Banana","Purple Pansy","Red Pansy","Red Daffodil","Yellow Daffodil","Purple Daffodil","Yellow Carnation"] },
  "Yellow Balloon Flower": { seed: "Bloom Seed", resources: ["Yellow Lotus"] },
  "Purple Balloon Flower": { seed: "Bloom Seed", resources: ["Blue Carnation"] },
  "White Balloon Flower":  { seed: "Bloom Seed", resources: ["White Cosmos","Blue Daffodil","White Daffodil","White Balloon Flower"] },
  "Blue Balloon Flower":   { seed: "Bloom Seed", resources: ["Cauliflower","Parsnip","Eggplant","Kale","Blue Pansy","Blue Cosmos","Purple Cosmos","Blue Balloon Flower","Celestial Frostbloom"] },
  "Red Daffodil":    { seed: "Bloom Seed", resources: ["Yellow Pansy","Yellow Balloon Flower","Red Carnation","Primula Enigma"] },
  "Yellow Daffodil": { seed: "Bloom Seed", resources: ["Red Cosmos","White Carnation","White Lotus"] },
  "Purple Daffodil": { seed: "Bloom Seed", resources: ["Radish","Blueberry","Red Balloon Flower","Red Lotus","Blue Lotus"] },
  "White Daffodil":  { seed: "Bloom Seed", resources: ["Yellow Cosmos","Prism Petal"] },
  "Blue Daffodil":   { seed: "Bloom Seed", resources: ["Purple Balloon Flower","Purple Carnation","Purple Lotus"] },
  "Celestial Frostbloom": { seed: "Bloom Seed", resources: ["White Pansy"] },
  "Red Carnation":    { seed: "Sprout Mix", resources: ["Yellow Cosmos","Red Balloon Flower","Yellow Lotus"] },
  "Yellow Carnation": { seed: "Sprout Mix", resources: ["Yellow Pansy","Red Balloon Flower","Yellow Carnation"] },
  "Purple Carnation": { seed: "Sprout Mix", resources: ["Blue Pansy","Purple Balloon Flower"] },
  "White Carnation":  { seed: "Sprout Mix", resources: ["Blue Pansy","White Balloon Flower","White Lotus","White Daffodil"] },
  "Blue Carnation":   { seed: "Sprout Mix", resources: ["Purple Cosmos","Purple Balloon Flower","Blue Carnation"] },
  "Red Lotus":    { seed: "Sprout Mix", resources: ["Red Pansy","Red Daffodil","Red Lotus"] },
  "Yellow Lotus": { seed: "Sprout Mix", resources: ["Red Pansy","Yellow Lotus"] },
  "Purple Lotus": { seed: "Sprout Mix", resources: ["Red Cosmos","Purple Daffodil","Purple Lotus"] },
  "White Lotus":  { seed: "Sprout Mix", resources: ["Yellow Daffodil","White Lotus"] },
  "Blue Lotus":   { seed: "Sprout Mix", resources: ["Blue Pansy","Blue Cosmos","Blue Lotus","Prism Petal"] },
  "Primula Enigma": { seed: "Sprout Mix", resources: ["Red Pansy","Red Daffodil"] },
};

const SEED_COLORS: Record<string, string> = {
  "Sunpetal Seed": "#f59e0b",
  "Bloom Seed":    "#ec4899",
  "Sprout Mix":    "#22c55e",
};

const SEED_GROUPS = ["Sunpetal Seed", "Bloom Seed", "Sprout Mix"];

interface FlowerResource { resourceName: string; enabled: boolean; multiplier: number; }
interface FlowerRule { flowerName: string; seed: string; enabled: boolean; seedMultiplier: number; resources: FlowerResource[]; }

const FlowerPlanterNode = memo(({ id, data }: any) => {
  const mini = data.miniCollapsed;
  const rules: FlowerRule[] = data.rules || [];
  const selectors: Record<string, string> = data.selectors || {};
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});
  const [showSelectors, setShowSelectors] = useState(false);

  const toggleExpand = (name: string) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleGroup  = (seed: string) => setGroupCollapsed(prev => ({ ...prev, [seed]: !prev[seed] }));

  const updateRule = (index: number, field: keyof FlowerRule, val: any) => {
    const updated = rules.map((r, i) => i === index ? { ...r, [field]: val } : r);
    data.onDataChange(id, { rules: updated });
  };

  const updateResource = (ruleIndex: number, resIndex: number, field: keyof FlowerResource, val: any) => {
    const updated = rules.map((r, i) => {
      if (i !== ruleIndex) return r;
      const newRes = r.resources.map((res, ri) => ri === resIndex ? { ...res, [field]: val } : res);
      return { ...r, resources: newRes };
    });
    data.onDataChange(id, { rules: updated });
  };

  const updateSelector = (itemName: string, val: string) => {
    data.onDataChange(id, { selectors: { ...selectors, [itemName]: val } });
  };

  // Збираємо унікальні назви насіння та ресурсів для меню селекторів
  const { allSeeds, allResources } = useMemo(() => {
    const seeds = new Set<string>();
    const resources = new Set<string>();
    Object.values(FLOWER_RECIPES).forEach(recipe => {
      seeds.add(recipe.seed);
      recipe.resources.forEach(r => resources.add(r));
    });
    return { 
      allSeeds: Array.from(seeds).sort(), 
      allResources: Array.from(resources).sort() 
    };
  }, []);

  return (
    <BaseNode id={id} data={data} icon={<Flower size={16}/>} title="Посадник Квіток" bgColor="#10b981" type="flowerPlanterNode" width="w-[340px]">
      <Handle type="target" position={Position.Left} id="in" style={getHandleStyle('#10b981','20px',mini)} className="!left-[-6px]"/>
      <Handle type="source" position={Position.Right} id="plant" style={getHandleStyle('#22c55e',mini?'50%':'30px',mini)} className="!right-[-6px]"/>
      <Handle type="source" position={Position.Right} id="skip"  style={getHandleStyle('#3b82f6',mini?'50%':'60px',mini)} className="!right-[-6px]"/>

      {!mini && (
        <div className="p-3 space-y-3">
          <div className="flex flex-col gap-1 text-[10px]">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"/><span className="text-green-400 font-medium">🌸 Посадити (кліки виконано)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"/><span className="text-sky-400 font-medium">⏭️ Пропустити (нічого не підходить)</span></div>
          </div>

          {/* МЕНЮ ГЛОБАЛЬНИХ СЕЛЕКТОРІВ */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 overflow-hidden">
            <button
              onClick={() => setShowSelectors(!showSelectors)}
              className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={13} className="text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-300">Селектори (Насіння та Ресурси)</span>
              </div>
              {showSelectors ? <ChevronDown size={13} className="text-slate-400"/> : <ChevronRight size={13} className="text-slate-400"/>}
            </button>
            {showSelectors && (
              <div className="p-2 border-t border-slate-700/60 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div>
                  <div className="text-[9px] font-bold text-amber-400 mb-1">НАСІННЯ:</div>
                  <div className="space-y-1">
                    {allSeeds.map(seed => (
                      <div key={seed} className="flex items-center gap-2 bg-slate-900/80 p-1 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-300 w-20 shrink-0 truncate" title={seed}>{seed}</span>
                        <Input
                          type="text" value={selectors[seed] || ''}
                          onChange={e => updateSelector(seed, e.target.value)}
                          placeholder="Селектор або ім'я"
                          className="flex-1 h-5 text-[9px] bg-slate-950 border-slate-700 px-1 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-sky-400 mb-1">РЕСУРСИ:</div>
                  <div className="space-y-1">
                    {allResources.map(res => (
                      <div key={res} className="flex items-center gap-2 bg-slate-900/80 p-1 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-300 w-20 shrink-0 truncate" title={res}>{res}</span>
                        <Input
                          type="text" value={selectors[res] || ''}
                          onChange={e => updateSelector(res, e.target.value)}
                          placeholder="Селектор або ім'я"
                          className="flex-1 h-5 text-[9px] bg-slate-950 border-slate-700 px-1 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted/30 p-2 rounded-lg border border-border/50 space-y-3">
            <div className="text-[10px] font-bold text-emerald-400 uppercase">Квітки ({rules.filter(r=>r.enabled).length}/{rules.length} увімкнено)</div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
              {SEED_GROUPS.map(seedName => {
                const groupRules = rules.map((r,i)=>({r,i})).filter(({r})=>r.seed===seedName);
                if (!groupRules.length) return null;
                const isCollapsed = groupCollapsed[seedName];
                const color = SEED_COLORS[seedName];
                const enabledCount = groupRules.filter(({r})=>r.enabled).length;
                return (
                  <div key={seedName} className="rounded-lg border border-slate-700/60 overflow-hidden">
                    <button
                      onClick={()=>toggleGroup(seedName)}
                      className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-800/50 transition-colors"
                      style={{borderLeft:`3px solid ${color}`}}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight size={13} className="text-slate-400"/> : <ChevronDown size={13} className="text-slate-400"/>}
                        <span className="text-[11px] font-bold" style={{color}}>{seedName}</span>
                        <span className="text-[10px] text-slate-500">({enabledCount}/{groupRules.length})</span>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-slate-800/60">
                        {groupRules.map(({r:rule, i:index})=>{
                          const isExp = expanded[rule.flowerName];
                          return (
                            <div key={rule.flowerName} className={`transition-colors ${rule.enabled?'bg-slate-800/50':'bg-slate-900/30'}`}>
                              <div className="flex items-center justify-between px-2 py-1.5">
                                <div className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0" onClick={()=>toggleExpand(rule.flowerName)}>
                                  {isExp?<ChevronDown size={12} className="text-slate-500 shrink-0"/>:<ChevronRight size={12} className="text-slate-500 shrink-0"/>}
                                  <span className={`text-[11px] font-medium truncate ${rule.enabled?'text-white':'text-slate-500'}`}>{rule.flowerName}</span>
                                </div>
                                <div className="flex items-center gap-2 ml-1 shrink-0">
                                  {rule.enabled&&<Check size={11} className="text-green-500"/>}
                                  <input type="checkbox" checked={rule.enabled} onChange={e=>updateRule(index,'enabled',e.target.checked)} className="w-4 h-4 accent-emerald-500 cursor-pointer"/>
                                </div>
                              </div>

                              {isExp && (
                                <div className="px-2 pb-2 space-y-2 border-t border-slate-700/40 pt-2">
                                  {/* Насіння */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-amber-400 font-bold w-14 shrink-0">🌱 Насіння:</span>
                                    <div className="flex-1"></div>
                                    <span className="text-[9px] text-slate-400">Кількість:</span>
                                    <Input
                                      type="number" min={1} value={rule.seedMultiplier||1}
                                      onChange={e=>updateRule(index,'seedMultiplier',Number(e.target.value)||1)}
                                      className="w-12 h-5 text-[9px] bg-slate-900 border-slate-700 px-1 text-center"
                                      title="Мін. кількість насіння"
                                    />
                                  </div>

                                  {/* Ресурси */}
                                  <div className="space-y-1">
                                    <span className="text-[9px] text-slate-400 font-bold">Ресурси (хоча б один):</span>
                                    <div className="space-y-1 bg-slate-900/40 rounded p-1 border border-slate-800">
                                      {rule.resources.map((res, ri)=>(
                                        <div key={res.resourceName} className={`flex items-center gap-1.5 rounded px-1 py-0.5 ${res.enabled?'bg-slate-800/60':''}`}>
                                          <button onClick={()=>updateResource(index,ri,'enabled',!res.enabled)} className="shrink-0" title={res.enabled?'Вимкнути':'Увімкнути'}>
                                            {res.enabled?<Eye size={10} className="text-emerald-400"/>:<EyeOff size={10} className="text-slate-600"/>}
                                          </button>
                                          <span className={`text-[9px] w-28 shrink-0 truncate ${res.enabled?'text-slate-300':'text-slate-600'}`}>{res.resourceName}</span>
                                          {res.enabled && (<>
                                            <div className="flex-1"></div>
                                            <span className="text-[9px] text-slate-500">Кількість:</span>
                                            <Input
                                              type="number" min={1} value={res.multiplier||1}
                                              onChange={e=>updateResource(index,ri,'multiplier',Number(e.target.value)||1)}
                                              className="w-10 h-5 text-[9px] bg-slate-900 border-slate-700 px-1 text-center"
                                              title="Мін. кількість ресурсу"
                                            />
                                          </>)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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

export default FlowerPlanterNode;
