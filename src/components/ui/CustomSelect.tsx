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
      <div className={`relative ${className}`}>
        <ListboxButton className="relative w-full cursor-pointer h-12 bg-appbg border-4 border-gameborder rounded-2xl pl-4 pr-10 text-left shadow-[inset_0_4px_0_0_rgba(165,151,176,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-oshipink focus-visible:border-oshipink flex items-center transition-all hover:brightness-95">
          <span className="block truncate font-zen font-bold text-ink text-sm">
            {selectedOption?.label}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <ChevronDown
              className="h-5 w-5 text-muted transition-transform duration-200 ui-open:rotate-180"
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
          <ListboxOptions className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border-4 border-gameborder bg-panel py-1 text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] focus:outline-none sm:text-sm custom-scrollbar">
            {options.map((option, idx) => (
              <ListboxOption
                key={idx}
                className="relative cursor-pointer select-none py-2.5 pl-10 pr-4 font-zen font-bold text-ink hover:bg-black/5 data-[focus]:bg-oshipink data-[focus]:text-buttontext transition-colors"
                value={option.value}
              >
                {({ selected }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-black' : 'font-bold'}`}>
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-current">
                        <Check className="h-4 w-4" aria-hidden="true" />
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
