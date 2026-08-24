import React, { type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'icon';
type ButtonSize = 'small' | 'medium' | 'large';

interface BaseButtonProps {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
}

const sizeClasses: Record<ButtonSize, string> = {
  small: 'px-3 py-1.5 text-[10px]',
  medium: 'px-4 py-2 text-[11px]',
  large: 'px-6 py-3 text-[12px]',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover)] text-white',
  secondary: 'bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover)] text-slate-200',
  danger: 'bg-[var(--button-danger-bg)] hover:bg-[var(--button-danger-hover)] text-white',
  success: 'bg-[var(--button-success-bg)] hover:bg-[var(--button-success-hover)] text-white',
  icon: 'bg-[var(--button-icon-bg)] hover:bg-[var(--button-icon-hover)] text-white p-2',
};

export const BaseButton: React.FC<BaseButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  title,
  type = 'button',
}) => {
  const isIcon = variant === 'icon';
  const baseClasses = isIcon 
    ? 'rounded-lg transition-all active:scale-95'
    : `${sizeClasses[size]} rounded-xl font-black uppercase tracking-widest shadow-lg transition-all duration-300 hover:scale-105 active:scale-95`;

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

export default BaseButton;
