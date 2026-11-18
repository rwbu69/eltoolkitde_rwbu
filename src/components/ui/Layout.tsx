import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * PageLayout: The main container for a view. 
 * On desktop (xl:), it creates a balanced two-column side-by-side workspace.
 * On mobile/tablet (< xl), it creates a clean, natural single-column scrolling page.
 */
export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col xl:flex-row gap-4 w-full h-full min-h-0 overflow-y-auto xl:overflow-hidden">
      {children}
    </div>
  );
}

/**
 * Column: A vertical flex container for layouts.
 * Use `isSidebar` for the secondary right-hand column (queue, results, logs).
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
  const sizeClass = isSidebar
    ? "w-full xl:w-[36%] xl:min-w-[340px] xl:max-w-[460px] xl:h-full shrink-0"
    : "w-full xl:flex-1 xl:h-full min-w-0";
  return (
    <div className={`flex flex-col gap-3 min-h-min xl:min-h-0 ${sizeClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * SectionHeader: Legacy skewed header kept for backward compatibility.
 */
export function SectionHeader({ 
  title, 
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
    ? 'text-inkinverse bg-ink border-2 border-subtleborder'
    : 'bg-panel border-2 text-ink border-subtleborder';

  return (
    <div className={`${alignClass} inline-block shrink-0 mb-1`}>
      <div className={`inline-block px-4 py-1 rounded-xl shadow-game-thin ${boxClass}`}>
        <h2 className="font-mono text-xs font-black tracking-wider uppercase">
          {title.replace(/_/g, ' ')}
        </h2>
      </div>
    </div>
  );
}

/**
 * Panel: Clean workstation surface with subtle borders and arcade drop shadow.
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
    <div className={`bg-panel border-2 border-subtleborder rounded-2xl shadow-game-thin flex flex-col min-h-min xl:min-h-0 ${noPadding ? '' : 'p-4 sm:p-5'} ${className}`}>
      {children}
    </div>
  );
}

/**
 * PanelScrollArea: Handles natural vertical flow on mobile, and internal scrolling on desktop.
 */
export function PanelScrollArea({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex-1 min-h-min xl:min-h-0 xl:overflow-y-auto custom-scrollbar pr-1.5 ${className}`}>
      {children}
    </div>
  );
}

/**
 * PanelHeader: A styled header for inside a Panel, especially useful when Panel has noPadding.
 */
export function PanelHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-3.5 border-b-2 border-subtleborder bg-panel rounded-t-2xl shrink-0 flex items-center justify-between ${className}`}>
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
  iconColor = 'text-toska'
}: { 
  text: string;
  icon?: LucideIcon;
  iconColor?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 mb-1.5 font-mono text-xs font-bold text-ink">
      {Icon && <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />}
      <span>{text}</span>
    </label>
  );
}
