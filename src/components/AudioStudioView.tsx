import { useState } from 'react';
import { FileAudio, RefreshCcw, Activity } from 'lucide-react';
import FfmpegView from './FfmpegView';
import MetadataView from './MetadataView';
import BpmModifierView from './BpmModifierView';
import { SegmentedDeck } from './ui/SegmentedDeck';

type AudioStudioTab = 'converter' | 'metadata' | 'bpm';

interface AudioStudioViewProps {
  isActive?: boolean;
}

export default function AudioStudioView({ isActive = false }: AudioStudioViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<AudioStudioTab>('converter');

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Studio Sub-Navigation Deck */}
      <div className="flex-none mb-3">
        <SegmentedDeck<AudioStudioTab>
          options={[
            { id: 'converter', label: 'Converter & Trim', icon: FileAudio },
            { id: 'metadata', label: 'Metadata Editor', icon: RefreshCcw },
            { id: 'bpm', label: 'BPM Tuner', icon: Activity },
          ]}
          activeId={activeSubTab}
          onChange={setActiveSubTab}
        />
      </div>

      {/* View Stages */}
      <div className="relative flex-1 min-h-0">
        <div className={activeSubTab === 'converter' ? 'h-full w-full' : 'hidden'}>
          <FfmpegView isActive={isActive && activeSubTab === 'converter'} />
        </div>
        <div className={activeSubTab === 'metadata' ? 'h-full w-full' : 'hidden'}>
          <MetadataView isActive={isActive && activeSubTab === 'metadata'} />
        </div>
        <div className={activeSubTab === 'bpm' ? 'h-full w-full' : 'hidden'}>
          <BpmModifierView isActive={isActive && activeSubTab === 'bpm'} />
        </div>
      </div>
    </div>
  );
}
