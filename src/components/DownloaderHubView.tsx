import { useState } from 'react';
import { Download, Library } from 'lucide-react';
import DownloaderView from './DownloaderView';
import KhinsiderView from './KhinsiderView';
import { useAppStore } from '../store/useAppStore';
import { SegmentedDeck } from './ui/SegmentedDeck';

type DownloaderSubTab = 'ytdlp' | 'khinsider';

export default function DownloaderHubView() {
  const { settings } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState<DownloaderSubTab>('ytdlp');
  const [hasOpenedKhinsider, setHasOpenedKhinsider] = useState(false);

  const handleSubTabChange = (tab: DownloaderSubTab) => {
    setActiveSubTab(tab);
    if (tab === 'khinsider') {
      setHasOpenedKhinsider(true);
    }
  };

  // If Khinsider is not enabled, directly render DownloaderView
  if (!settings.enableKhinsider) {
    return <DownloaderView />;
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Downloader Sub-Navigation Deck (Only shown when Khinsider is enabled) */}
      <div className="flex-none mb-3">
        <SegmentedDeck<DownloaderSubTab>
          options={[
            { id: 'ytdlp', label: 'Web Downloader', icon: Download },
            { id: 'khinsider', label: 'Game Music (Khinsider)', icon: Library },
          ]}
          activeId={activeSubTab}
          onChange={handleSubTabChange}
        />
      </div>

      {/* View Stages */}
      <div className="relative flex-1 min-h-0">
        <div className={activeSubTab === 'ytdlp' ? 'h-full w-full' : 'hidden'}>
          <DownloaderView />
        </div>
        <div className={activeSubTab === 'khinsider' ? 'h-full w-full' : 'hidden'}>
          {hasOpenedKhinsider && <KhinsiderView />}
        </div>
      </div>
    </div>
  );
}
