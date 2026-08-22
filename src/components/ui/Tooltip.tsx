import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ text, children, position = 'bottom', className = '' }: TooltipProps) {
  const getPositionClasses = () => {
    switch (position) {
      case 'top': return 'bottom-full mb-2 left-1/2 -translate-x-1/2';
      case 'bottom': return 'top-full mt-2 left-1/2 -translate-x-1/2';
      case 'left': return 'right-full mr-2 top-1/2 -translate-y-1/2';
      case 'right': return 'left-full ml-2 top-1/2 -translate-y-1/2';
      default: return 'top-full mt-2 left-1/2 -translate-x-1/2';
    }
  };

  return (
    <div className={`group relative inline-flex justify-center items-center ${className}`}>
      {children}
      <div 
        className={`absolute z-[999] pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 ${getPositionClasses()}`}
      >
        <div className="bg-ink text-white border-2 border-white shadow-game-thin rounded-lg px-3 py-1.5 whitespace-nowrap">
          <span className="font-mono text-xs font-bold tracking-wider">{text}</span>
        </div>
      </div>
    </div>
  );
}
