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
}

export function Tabs<T extends string>({ options, value, onChange }: TabsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {options.map((opt) => (
        <button 
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-[44px] min-w-[80px] px-2 text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors ${
            value === opt.value ? 'game-btn-primary' : 'game-btn-secondary text-ink'
          }`}
        >
          {opt.icon && <opt.icon className="w-4 h-4 mr-1.5" />} {opt.label}
        </button>
      ))}
    </div>
  );
}
