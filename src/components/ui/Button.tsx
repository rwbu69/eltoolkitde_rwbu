import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  fullWidth?: boolean;
  isLoading?: boolean;
}

export function Button({ 
  children, 
  variant = 'secondary', 
  size,
  icon: Icon, 
  fullWidth = false, 
  isLoading = false,
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const resolvedSize = size || (variant === 'primary' ? 'lg' : 'md');

  let sizeClass = 'h-10 text-xs px-3.5';
  if (resolvedSize === 'lg') {
    sizeClass = 'h-11 text-xs sm:text-sm px-4';
  } else if (resolvedSize === 'sm') {
    sizeClass = 'h-8 text-xs font-mono px-2.5 rounded-lg';
  }

  let baseClass = '';
  if (variant === 'primary') {
    baseClass = `game-btn-primary ${sizeClass} font-zen font-bold`;
  } else if (variant === 'secondary') {
    baseClass = `game-btn-secondary ${sizeClass} font-zen font-bold`;
  } else if (variant === 'danger') {
    baseClass = `game-btn-secondary ${sizeClass} font-zen font-bold border-oshipink text-oshipink hover:bg-oshipink hover:text-buttontext border-2`;
  }

  const widthClass = fullWidth ? 'w-full' : '';
  const flexClass = 'flex items-center justify-center gap-2';

  return (
    <button 
      className={`${baseClass} ${widthClass} ${flexClass} shrink-0 ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
