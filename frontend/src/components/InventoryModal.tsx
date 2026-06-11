import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

interface ScanResult {
  image: string;
  number: number;
}

interface InventoryResponse {
  data: ScanResult[];
  timestamp: number | null;
  projectName: string;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ isOpen, onClose, projectName }) => {
  const [data, setData] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);

  // Fetch inventory data from API
  const fetchInventory = useCallback(async () => {
    if (!projectName) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${encodeURIComponent(projectName)}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Необхідна аутентифікація');
        } else if (response.status === 429) {
          throw new Error('Занадто багато запитів. Спробуйте пізніше.');
        } else if (response.status === 400) {
          throw new Error('Неправильне ім\'я проекту');
        } else {
          throw new Error('Не вдалося завантажити дані інвентаря');
        }
      }

      const result: InventoryResponse = await response.json();
      setData(result.data || []);
      setTimestamp(result.timestamp);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setError(err instanceof Error ? err.message : 'Помилка мережі. Перевірте з\'єднання.');
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  // Load inventory when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen, fetchInventory]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23374151"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239CA3AF" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    // Overlay with backdrop
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
    >
      {/* Modal container */}
      <div
        className="flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl border bg-[var(--interface-bg)] border-[var(--interface-border)] backdrop-blur-md overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div>
            <h2 
              id="inventory-modal-title" 
              className="text-[14px] font-black uppercase text-indigo-400 tracking-widest"
            >
              Інвентар
            </h2>
            <p className="text-[12px] font-bold text-slate-200 mt-0.5">{projectName}</p>
            {timestamp && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Оновлено: {new Date(timestamp).toLocaleString('uk-UA')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted/30 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            title="Закрити"
            aria-label="Закрити модальне вікно"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Завантаження інвентаря...</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-red-400 text-center">
                <p className="text-lg font-bold mb-2">❌ Помилка</p>
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={fetchInventory}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all active:scale-95"
              >
                Спробувати знову
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="text-slate-400">
                <p className="text-2xl mb-2">📦</p>
                <p className="text-lg font-bold mb-1">Інвентар порожній</p>
                <p className="text-sm">Запустіть бота з нодою сканування інвентаря</p>
              </div>
            </div>
          )}

          {/* Grid display */}
          {!loading && !error && data.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {data.map((item, index) => (
                <div
                  key={index}
                  className="relative flex flex-col items-center justify-center p-2 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 hover:border-indigo-500/30 transition-all group"
                >
                  {/* Image */}
                  <div className="relative w-full aspect-square rounded-md overflow-hidden bg-slate-900/50">
                    <img
                      src={item.image}
                      alt={`Inventory item ${index + 1}`}
                      className="w-full h-full object-contain"
                      onError={handleImageError}
                      loading="lazy"
                    />
                    
                    {/* Number badge - top right only */}
                    <div className="absolute top-0.5 right-0.5 px-1.5 py-0.5 bg-indigo-600/90 backdrop-blur-sm text-white text-xs font-bold rounded shadow-lg border border-indigo-400/30">
                      {item.number}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
