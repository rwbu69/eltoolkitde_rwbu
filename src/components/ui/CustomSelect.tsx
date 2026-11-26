import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CustomSelect({ options, value, onChange, className = '' }: CustomSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={`relative h-10 ${className}`}>
        <ListboxButton className="relative w-full cursor-pointer h-10 bg-panel border-2 border-subtleborder hover:border-gameborder rounded-xl pl-3 pr-8 text-left shadow-none focus:outline-none focus-visible:ring-1 focus-visible:ring-oshipink focus-visible:border-oshipink flex items-center transition-colors box-border">
          <span className="block truncate font-zen font-bold text-ink text-xs">
            {selectedOption?.label}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <ChevronDown
              className="h-4 w-4 text-muted transition-transform duration-200 ui-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </ListboxButton>
        <Transition
          enter="transition duration-100 ease-out"
          enterFrom="transform scale-95 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition duration-75 ease-out"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-95 opacity-0"
        >
          <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border-2 border-gameborder bg-panel p-1 text-xs shadow-lg focus:outline-none custom-scrollbar">
            {options.map((option, idx) => (
              <ListboxOption
                key={idx}
                className="relative cursor-pointer select-none rounded-lg py-2 pl-8 pr-3 font-zen font-bold text-ink data-[focus]:bg-oshipink data-[focus]:text-buttontext transition-colors"
                value={option.value}
              >
                {({ selected }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-black' : 'font-bold'}`}>
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-current">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
