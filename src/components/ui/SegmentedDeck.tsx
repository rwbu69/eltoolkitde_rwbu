import { LucideIcon } from 'lucide-react';

export interface DeckOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  badge?: string;
}

interface SegmentedDeckProps<T extends string> {
  options: DeckOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

export function SegmentedDeck<T extends string>({
  options,
  activeId,
  onChange,
  className = '',
}: SegmentedDeckProps<T>) {
  return (
    <div
      role="tablist"
      className={`flex items-center w-full gap-2 p-1 bg-appbg/80 border-2 border-gameborder rounded-2xl shadow-sm ${className}`}
    >
      {options.map((option) => {
        const isActive = activeId === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={`flex-1 h-11 px-3 rounded-xl border-2 font-zen text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-150 select-none ${
              isActive
                ? 'bg-oshipink text-buttontext border-gameborder shadow-game-thin'
                : 'bg-panel text-ink border-transparent hover:border-gameborder/40 hover:text-ink'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span className="truncate">{option.label}</span>

            {/* High-Contrast Badge */}
            {typeof option.count === 'number' && option.count > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-[9px] font-mono font-black rounded-full border leading-none ${
                  isActive
                    ? 'bg-gameborder text-panel border-gameborder/50'
                    : 'bg-oshipink text-buttontext border-gameborder'
                }`}
              >
                {option.count > 99 ? '99+' : option.count}
              </span>
            )}

            {option.badge && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-[9px] font-mono font-black rounded-full border leading-none ${
                  isActive
                    ? 'bg-gameborder text-panel border-gameborder/50'
                    : 'bg-toska text-buttontext border-gameborder'
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
