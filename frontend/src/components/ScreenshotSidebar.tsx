// Права панель для перегляду та управління скріншотами проекту
import React, { useState, useEffect } from 'react';
import { Camera, X, Trash2, Maximize2, PanelRightClose } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

interface ScreenshotSidebarProps {
  projectName: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
}

const ScreenshotSidebar: React.FC<ScreenshotSidebarProps> = ({
  projectName,
  isCollapsed,
  onToggle
}) => {
  const lastSavedScreenshot = useUIStore((s) => s.lastSavedScreenshot);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch screenshots list
  const fetchScreenshots = async () => {
    if (!projectName) return;
    try {
      const res = await fetch(`/api/screenshots/${projectName}`);
      if (res.ok) {
        const data = await res.json();
        setScreenshots(data);
      }
    } catch (e) {
      console.error('Failed to fetch screenshots:', e);
    }
  };

  // Fetch on project change
  useEffect(() => {
    if (projectName) {
      fetchScreenshots();
    } else {
      setScreenshots([]);
    }
  }, [projectName]);

  // Auto-refresh on Zustand store or custom event
  useEffect(() => {
    if (lastSavedScreenshot && lastSavedScreenshot.projectName === projectName) {
      fetchScreenshots();
    }
  }, [lastSavedScreenshot, projectName]);

  useEffect(() => {
    const handleScreenshotSaved = (e: CustomEvent) => {
      if (e.detail.projectName === projectName) {
        fetchScreenshots();
      }
    };

    window.addEventListener('screenshot-saved', handleScreenshotSaved as EventListener);
    return () => {
      window.removeEventListener('screenshot-saved', handleScreenshotSaved as EventListener);
    };
  }, [projectName]);

  // Delete screenshot
  const handleDelete = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Видалити скріншот ${filename}?`)) return;
    
    if (!projectName) return;
    try {
      const res = await fetch(`/api/screenshots/${projectName}/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchScreenshots();
      }
    } catch (e) {
      console.error('Failed to delete screenshot:', e);
    }
  };

  // Get image URL
  const getImageUrl = (filename: string) => {
    return `/api/screenshots/${projectName}_screenshots/${filename}`;
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--interface-bg)] border-l border-[var(--accent-pink)]/30 shadow-xl z-[var(--z-sidebar)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--accent-pink)]/30 bg-[var(--accent-pink)]/10">
        <div className="flex items-center gap-2 text-[var(--accent-pink)]">
          <Camera size={18} />
          <span className="text-sm font-semibold">Скріншоти</span>
          <span className="text-xs text-muted-foreground">({screenshots.length})</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 text-muted-foreground hover:text-[var(--accent-pink)] transition-colors"
          title="Закрити"
        >
          <PanelRightClose size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {!projectName ? (
          <p className="text-xs text-muted-foreground text-center mt-8">
            Виберіть проект для перегляду скріншотів
          </p>
        ) : screenshots.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">
            Немає скріншотів.<br />
            Додайте ноду "Скріншот" для створення.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((filename) => (
              <div
                key={filename}
                className="relative group cursor-pointer rounded-lg overflow-hidden border border-border hover:border-[var(--accent-pink)]/50 transition-all"
                onClick={() => setSelectedImage(filename)}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-muted">
                  <img
                    src={getImageUrl(filename)}
                    alt={filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Filename */}
                <div className="p-1.5 bg-[var(--interface-bg)]">
                  <p className="text-[9px] text-muted-foreground truncate" title={filename}>
                    {filename}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(filename, e)}
                  className="absolute top-1 right-1 p-1 bg-[var(--button-danger-bg)]/80 hover:bg-[var(--button-danger-bg)] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Видалити"
                >
                  <Trash2 size={12} />
                </button>

                {/* Expand button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(filename);
                  }}
                  className="absolute top-1 left-1 p-1 bg-black/50 hover:bg-black/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Переглянути"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-size image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[var(--z-modal-high)] flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            title="Закрити"
          >
            <X size={24} />
          </button>
          <img
            src={getImageUrl(selectedImage)}
            alt={selectedImage}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80 bg-black/50 px-3 py-1 rounded">
            {selectedImage}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScreenshotSidebar;
