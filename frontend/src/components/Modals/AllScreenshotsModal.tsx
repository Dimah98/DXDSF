import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Loader2, Camera, Download, Trash2, Expand } from 'lucide-react';
import { createPortal } from 'react-dom';

interface AllScreenshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AllScreenshotsModal: React.FC<AllScreenshotsModalProps> = ({ isOpen, onClose }) => {
  const [screenshots, setScreenshots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [fullImage, setFullImage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const projRes = await fetch('/api/projects');
      const projects: string[] = await projRes.json();
      
      const allShots: Record<string, string[]> = {};
      await Promise.all(projects.map(async (proj) => {
        try {
          const res = await fetch(`/api/screenshots/${proj}`);
          if (res.ok) {
            const files = await res.json();
            if (files && files.length > 0) {
              allShots[proj] = files.sort((a: string, b: string) => b.localeCompare(a));
            }
          }
        } catch (e) {
          // ignore
        }
      }));
      setScreenshots(allShots);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  const handleDelete = async (proj: string, file: string) => {
    try {
      await fetch(`/api/screenshots/${proj}/${file}`, { method: 'DELETE' });
      setScreenshots(prev => ({
        ...prev,
        [proj]: prev[proj].filter(f => f !== file)
      }));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="text-pink-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Всі Скріншоти</h2>
          </div>
          <div className="flex items-center gap-2">
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
              <span>Завантаження скріншотів...</span>
            </div>
          ) : Object.keys(screenshots).length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/50">
              Немає жодного скріншоту
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(screenshots).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })).map(([proj, files]) => {
                if (files.length === 0) return null;
                return (
                  <div key={proj} className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <h3 className="text-sm font-black uppercase tracking-wider text-pink-300 mb-4">{proj}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {files.map(file => {
                        const url = `/api/screenshots/${proj}/${file}`;
                        return (
                          <div key={file} className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-white/10">
                            <img src={url} alt={file} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                              <span className="text-[10px] text-white font-mono truncate">{file}</span>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <button onClick={() => setFullImage(url)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white"><Expand size={14} /></button>
                                <a href={url} download={file} className="p-1.5 bg-indigo-500/80 hover:bg-indigo-500 rounded text-white"><Download size={14} /></a>
                                <button onClick={() => handleDelete(proj, file)} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded text-white"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {fullImage && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in" onClick={() => setFullImage(null)}>
          <div className="relative max-w-full max-h-full">
            <button className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white" onClick={() => setFullImage(null)}><X size={24} /></button>
            <img src={fullImage} className="max-w-full max-h-[90vh] object-contain rounded-xl border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
