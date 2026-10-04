import { FolderOpen } from 'lucide-react';
import { Input } from './Input';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from './Button';

interface PathPickerProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  directory?: boolean;
  filters?: { name: string; extensions: string[] }[];
}

export function PathPicker({
  value,
  onChange,
  placeholder = "Select path...",
  directory = true,
  filters
}: PathPickerProps) {
  const handleSelect = async () => {
    try {
      const selected = await open({ directory, multiple: false, filters });
      if (selected && typeof selected === 'string') {
        onChange(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        type="text"
        value={value}
        readOnly
        placeholder={placeholder}
        className="flex-1 min-w-0"
      />
      <Button 
        onClick={handleSelect}
        variant="secondary"
        className="px-4 h-[48px] !rounded-2xl"
        title="Select Path"
      >
        <FolderOpen className="w-5 h-5" />
      </Button>
    </div>
  );
}
