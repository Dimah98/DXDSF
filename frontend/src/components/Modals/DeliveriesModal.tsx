import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';

interface DeliveryReward {
  coins?: number;
  sfl?: number;
  items?: Record<string, number>;
}

interface Delivery {
  id: string;
  from: string;
  items: Record<string, number>;
  reward?: DeliveryReward;
  completedAt?: number | null;
}

interface DeliveriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
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

export const DeliveriesModal: React.FC<DeliveriesModalProps> = ({ isOpen, onClose, projectName }) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const [delRes, invRes] = await Promise.all([
        fetch(`/api/deliveries/${projectName}`),
        fetch(`/api/inventory/${projectName}`)
      ]);
      const delData = await delRes.json();
      setDeliveries(delData.data || []);

      const invData = await invRes.json();
      const invMap: Record<string, number> = {};
      (invData.data || []).forEach((item: any) => {
        // match image name or parse it
        const name = item.image.split('.')[0].toLowerCase();
        invMap[name] = item.number;
      });
      setInventory(invMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Доставки</h2>
            <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-black uppercase rounded-lg">
              {projectName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
              title="Оновити"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/50">
              <Loader2 className="animate-spin mb-2" size={24} />
              <span>Завантаження...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-white/50">
              Немає доступних доставок
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {deliveries.map(delivery => {
                const isCompleted = !!delivery.completedAt;
                const hasResources = Object.entries(delivery.items).every(([name, req]) => {
                  const avail = inventory[name.toLowerCase()] || 0;
                  return avail >= req;
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

                const npcImage = getNpcFileName(delivery.from);

                return (
                  <div key={delivery.id} className={`p-3 rounded-xl border ${borderColor} ${glowColor} flex flex-col gap-2`}>
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                        <img 
                          src={`/api/im/${npcImage}.png`} 
                          alt={delivery.from}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-xs font-bold text-white/80 uppercase">{delivery.from}</span>
                        <div className="grid grid-cols-1 gap-1">
                          {Object.entries(delivery.items).map(([name, amount]) => {
                            const avail = inventory[name.toLowerCase()] || 0;
                            const enough = avail >= amount;
                            return (
                              <div key={name} className="flex items-center justify-between text-xs">
                                <span className="text-white/60 truncate mr-2" title={name}>{name}</span>
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
