import React, { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  showCloseButton?: boolean;
  zIndex?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  icon,
  maxWidth = 'max-w-5xl',
  maxHeight = 'h-[85vh]',
  showCloseButton = true,
  zIndex = 'z-[var(--z-modal-high)]'
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} ${maxHeight} flex flex-col bg-[var(--interface-bg)] border border-[var(--interface-border)] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || icon || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-white/5">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex items-center justify-center">
                  {icon}
                </div>
              )}
              {title && (
                <h2 className="text-[14px] font-bold text-[var(--interface-text-primary)]">
                  {title}
                </h2>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Закрити"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseModal;
