import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * PageLayout: The main container for a view. 
 * Forces the view to take up the remaining height and handles the column gap.
 */
export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-row gap-4 w-full h-full min-h-0 overflow-hidden">
      {children}
    </div>
  );
}

/**
 * Column: A vertical flex container for side-by-side layouts.
 * Use `isSidebar` for the smaller right-hand column.
 */
export function Column({ 
  children, 
  isSidebar = false,
  className = ''
}: { 
  children: React.ReactNode; 
  isSidebar?: boolean;
  className?: string;
}) {
  const baseClass = "flex flex-col gap-4 h-full min-h-0";
  const sizeClass = isSidebar ? "w-[280px] xl:w-[350px] shrink-0" : "flex-1 min-w-0";
  return (
    <div className={`${baseClass} ${sizeClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * SectionHeader: The dynamic skewed header `>> TITLE`.
 */
export function SectionHeader({ 
  title, 
  icon: Icon,
  align = 'left',
  variant = 'primary'
}: { 
  title: string; 
  icon?: LucideIcon;
  align?: 'left' | 'right';
  variant?: 'primary' | 'secondary';
}) {
  const alignClass = align === 'left' ? 'self-start' : 'self-end';
  
  const boxClass = variant === 'primary' 
    ? 'text-white bg-ink border-4 border-ink border-l-oshipink'
    : 'bg-white border-4 text-ink border-ink';

  return (
    <div className={`${alignClass} inline-block shrink-0`}>
      <div className={`inline-block px-5 py-1.5 rounded-xl shadow-game-thin ${boxClass}`}>
        <h2 className="flex items-center gap-2 font-mono text-base font-black tracking-widest">
          {Icon && <Icon className={`w-5 h-5 ${variant === 'primary' ? 'text-oshipink' : 'text-toska'}`} />}
          {title.replace(/_/g, ' ')}
        </h2>
      </div>
    </div>
  );
}

/**
 * Panel: The main white box with thick borders and shadows.
 * Using `flex flex-col min-h-0` ensures inner contents can scroll if needed.
 */
export function Panel({ 
  children, 
  className = '',
  noPadding = false
}: { 
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={`bg-white border-4 border-ink rounded-3xl shadow-game-thick flex flex-col min-h-0 ${noPadding ? '' : 'p-5'} ${className}`}>
      {children}
    </div>
  );
}

/**
 * PanelScrollArea: A designated area inside a panel that handles scrolling.
 */
export function PanelScrollArea({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-2 ${className}`}>
      {children}
    </div>
  );
}

/**
 * FormLabel: Standardized label component with icon support.
 */
export function FormLabel({ 
  text, 
  icon: Icon,
  iconColor = 'text-oshipink'
}: { 
  text: string;
  icon?: LucideIcon;
  iconColor?: string;
}) {
  return (
    <label className="flex items-center gap-2 mb-2 font-mono text-sm font-black text-ink uppercase">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      {text}
    </label>
  );
}
