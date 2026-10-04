interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  variant?: 'checkbox' | 'switch';
}

export function Toggle({ checked, onChange, label, description, variant = 'checkbox' }: ToggleProps) {
  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer group mt-2 select-none" onClick={() => onChange(!checked)}>
        {variant === 'checkbox' ? (
          <div className={`relative flex items-center justify-center w-6 h-6 border-4 border-gameborder rounded-md transition-colors ${checked ? 'bg-panel' : 'bg-appbg'}`}>
            <input 
              type="checkbox" 
              className="absolute opacity-0 cursor-pointer w-full h-full"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            {checked && <div className="w-2.5 h-2.5 bg-toska rounded-sm" />}
          </div>
        ) : (
          <div className={`w-12 h-6 rounded-full border-2 border-gameborder transition-colors relative ${checked ? 'bg-toska' : 'bg-muted'}`}>
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-panel border-2 border-gameborder rounded-full transition-transform ${checked ? 'translate-x-6' : ''}`}></div>
            <input 
              type="checkbox" 
              className="absolute opacity-0 cursor-pointer w-full h-full z-10"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <span className={`font-bold font-mono text-ink group-hover:text-toska transition-colors ${variant === 'switch' ? 'text-xs uppercase' : 'text-sm'}`}>
          {label}
        </span>
      </label>
      {description && (
        <p className="mt-2 text-[10px] font-mono font-bold text-muted uppercase">{description}</p>
      )}
    </div>
  );
}
