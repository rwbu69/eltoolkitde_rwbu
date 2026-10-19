export interface OptionGridItem<T extends string> {
  value: T;
  label: string;
}

interface OptionGridProps<T extends string> {
  options: readonly OptionGridItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: OptionGridProps<T>) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`h-10 rounded-lg border-2 px-2 font-zen text-xs font-bold transition-all duration-150 ${
              selected
                ? 'bg-oshipink text-buttontext border-oshipink shadow-[0_2px_0_0_rgba(76,79,105,0.45)]'
                : 'bg-panel text-ink border-gameborder/60 hover:border-gameborder hover:bg-appbg'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
