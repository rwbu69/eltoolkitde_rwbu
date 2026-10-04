import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
  fullWidth?: boolean;
  isLoading?: boolean;
}

export function Button({ 
  children, 
  variant = 'secondary', 
  icon: Icon, 
  fullWidth = false, 
  isLoading = false,
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  let baseClass = '';
  if (variant === 'primary') {
    baseClass = 'game-btn-primary h-[48px] font-zen font-black text-base';
  } else if (variant === 'secondary') {
    baseClass = 'game-btn-secondary h-[44px] text-xs';
  } else if (variant === 'danger') {
    baseClass = 'game-btn-secondary h-[48px] font-zen font-black text-base border-oshipink text-oshipink hover:bg-oshipink hover:text-buttontext border-2';
  }

  const widthClass = fullWidth ? 'w-full' : '';
  const flexClass = 'flex items-center justify-center gap-2';

  return (
    <button 
      className={`${baseClass} ${widthClass} ${flexClass} shrink-0 ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {children}
    </button>
  );
}
