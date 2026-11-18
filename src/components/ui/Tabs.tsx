import { LucideIcon } from 'lucide-react';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ options, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`flex items-center gap-2 w-full h-10 ${className}`}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button 
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-10 min-w-0 px-2 sm:px-3 text-xs font-zen font-bold rounded-xl border-2 flex items-center justify-center shrink-0 transition-colors shadow-none select-none box-border ${
              isActive 
                ? 'bg-oshipink text-buttontext border-gameborder' 
                : 'bg-panel text-muted hover:text-ink hover:bg-appbg border-subtleborder hover:border-gameborder'
            }`}
          >
            {opt.icon && <opt.icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
