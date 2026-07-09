import { useState, useEffect } from 'react';

export interface AppSettings {
  defaultOutputDir: string;
  defaultVideoQuality: 'best' | 'mid' | 'low';
  defaultAudioBitrate: '320k' | '256k' | '192k';
  cookiesFilePath: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: '',
  defaultVideoQuality: 'best',
  defaultAudioBitrate: '320k',
  cookiesFilePath: '',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('eltoolkit_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('eltoolkit_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return { settings, updateSettings };
}
