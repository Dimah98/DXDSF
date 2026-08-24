import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';

interface Delivery {
  id: string;
  from: string;
  items: Record<string, number>;
  completedAt?: number | null;
  projectName?: string; // Extended
}

interface AllDeliveriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const npcNameMap: Record<string, string> = {
  "pumpkin' pete": "pumpkin- pete",
  "old salty": "old salty"
};

const getNpcFileName = (location: string) => {
  if (!location) return "";
  const lower = location.toLowerCase();
  return npcNameMap[lower] || lower;
};

export const AllDeliveriesModal: React.FC<AllDeliveriesModalProps> = ({ isOpen, onClose }) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [inventories, setInventories] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const projRes = await fetch('/api/projects');
      const projects: string[] = await projRes.json();

      let allDeliveries: Delivery[] = [];
      const allInventories: Record<string, Record<string, number>> = {};

      await Promise.all(projects.map(async (proj) => {
        try {
          const [delRes, invRes] = await Promise.all([
            fetch(`/api/deliveries/${proj}`),
            fetch(`/api/inventory/${proj}`)
          ]);
          
          const delData = await delRes.json();
          if (delData.data) {
            allDeliveries.push(...delData.data.map((d: any) => ({ ...d, projectName: proj })));
          }

          const invData = await invRes.json();
          const invMap: Record<string, number> = {};
          if (invData.data) {
            invData.data.forEach((item: any) => {
              const name = item.image.split('.')[0].toLowerCase();
              invMap[name] = item.number;
            });
          }
          allInventories[proj] = invMap;
        } catch (e) {
          // ignore error for single project
        }
      }));

      // Sort deliveries: active first, then completed
      allDeliveries.sort((a, b) => {
        if (a.completedAt && !b.completedAt) return 1;
        if (!a.completedAt && b.completedAt) return -1;
        return 0;
      });

      setDeliveries(allDeliveries);
      setInventories(allInventories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract unique NPCs
  const uniqueNpcs = Array.from(new Set(deliveries.map(d => d.from))).sort();

  const filteredDeliveries = selectedNpc 
    ? deliveries.filter(d => d.from === selectedNpc)
    : deliveries;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
          <h2 className="text-xl font-bold text-white tracking-tight">Всі Доставки</h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* NPC Filter */}
        <div className="flex items-center gap-2 p-3 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setSelectedNpc(null)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              !selectedNpc ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            Всі
          </button>
          {uniqueNpcs.map(npc => (
            <button
              key={npc}
              onClick={() => setSelectedNpc(npc)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                selectedNpc === npc ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <img src={`/api/im/${getNpcFileName(npc)}.png`} alt={npc} className="w-5 h-5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="uppercase">{npc}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span>Збір інформації з усіх проектів...</span>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/50">
              Немає доставок
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredDeliveries.map((delivery, idx) => {
                const isCompleted = !!delivery.completedAt;
                const inv = inventories[delivery.projectName || ''] || {};
                const hasResources = Object.entries(delivery.items).every(([name, req]) => {
                  return (inv[name.toLowerCase()] || 0) >= req;
                });

                let borderColor = 'border-red-500/50';
                let glowColor = 'bg-red-500/5';
                if (isCompleted) {
                  borderColor = 'border-emerald-500/50';
                  glowColor = 'bg-emerald-500/5';
                } else if (hasResources) {
                  borderColor = 'border-amber-500/50';
                  glowColor = 'bg-amber-500/5';
                }

                return (
                  <div key={`${delivery.projectName}-${delivery.id}-${idx}`} className={`p-3 rounded-xl border ${borderColor} ${glowColor} flex flex-col gap-2`}>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-1">
                      <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">{delivery.projectName}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                        <img 
                          src={`/api/im/${getNpcFileName(delivery.from)}.png`} 
                          alt={delivery.from}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-white/80 uppercase">{delivery.from}</span>
                        <div className="grid grid-cols-1 gap-1">
                          {Object.entries(delivery.items).map(([name, amount]) => {
                            const avail = inv[name.toLowerCase()] || 0;
                            const enough = avail >= amount;
                            return (
                              <div key={name} className="flex items-center justify-between text-[10px]">
                                <span className="text-white/60 truncate mr-1" title={name}>{name}</span>
                                <span className={`font-mono font-bold ${enough ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {avail}/{amount}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
