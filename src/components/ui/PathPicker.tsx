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
  compact?: boolean;
}

export function PathPicker({
  value,
  onChange,
  placeholder = "Select path...",
  directory = true,
  filters,
  compact = false
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
    <div className={`flex gap-2 items-center h-10 ${compact ? 'min-w-0' : 'w-full'}`}>
      <Input
        type="text"
        value={value}
        readOnly
        placeholder={placeholder}
        title={value || placeholder}
        className={`flex-1 min-w-0 h-10 box-border ${compact ? 'kh-input px-3' : ''}`}
      />
      <Button 
        onClick={handleSelect}
        variant="secondary"
        size="md"
        className="h-10 w-10 !px-0 flex items-center justify-center shrink-0 rounded-xl box-border"
        title={directory ? "Select Directory" : "Select File"}
        aria-label={directory ? "Select Directory" : "Select File"}
      >
        <FolderOpen className="w-4 h-4 text-muted hover:text-ink" />
      </Button>
    </div>
  );
}
