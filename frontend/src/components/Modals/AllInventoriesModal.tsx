import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Loader2, Package } from 'lucide-react';

interface AllInventoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AllInventoriesModal: React.FC<AllInventoriesModalProps> = ({ isOpen, onClose }) => {
  const [inventories, setInventories] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const projRes = await fetch('/api/projects');
      const projects: string[] = await projRes.json();
      
      const allInv: Record<string, Record<string, number>> = {};
      await Promise.all(projects.map(async (proj) => {
        try {
          const res = await fetch(`/api/inventory/${proj}`);
          if (res.ok) {
            const data = await res.json();
            if (data.data && data.data.length > 0) {
              const invMap: Record<string, number> = {};
              data.data.forEach((item: any) => {
                const name = item.image.split('.')[0];
                invMap[name] = item.number;
              });
              allInv[proj] = invMap;
            }
          }
        } catch (e) {
          // ignore
        }
      }));
      setInventories(allInv);
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

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Package className="text-indigo-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Всі Інвентарі</h2>
          </div>
          <div className="flex items-center gap-4">
            <input 
              type="text" 
              placeholder="Пошук ресурсу..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span>Завантаження інвентарів...</span>
            </div>
          ) : Object.keys(inventories).length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/50">
              Не знайдено інвентарів
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(inventories).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })).map(([proj, items]) => {
                const filteredItems = Object.entries(items).filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()));
                if (filteredItems.length === 0) return null;
                
                return (
                  <div key={proj} className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <h3 className="text-sm font-black uppercase tracking-wider text-indigo-300 mb-4">{proj}</h3>
                    <div className="flex flex-wrap gap-2">
                      {filteredItems.sort((a, b) => b[1] - a[1]).map(([name, amount]) => (
                        <div key={name} className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-1.5 pr-3">
                          <img 
                            src={`/api/im/${name}.png`} 
                            alt={name} 
                            className="w-6 h-6 object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div className="flex flex-col">
                            <span className="text-[9px] text-white/50 uppercase leading-none">{name}</span>
                            <span className="text-xs font-bold text-white leading-tight">{amount}</span>
                          </div>
                        </div>
                      ))}
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
