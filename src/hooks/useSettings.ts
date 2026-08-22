import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  defaultOutputDir: string;
  defaultVideoQuality: 'best' | 'mid' | 'low';
  defaultAudioBitrate: '320k' | '256k' | '192k';
  cookiesFilePath: string;
  browserForCookies: string;
  closeToTray: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: '',
  defaultVideoQuality: 'best',
  defaultAudioBitrate: '320k',
  cookiesFilePath: '',
  browserForCookies: '',
  closeToTray: true,
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
    const handleSettingsUpdated = () => {
      const saved = localStorage.getItem('eltoolkit_settings');
      if (saved) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        } catch (e) {
          console.error('Failed to parse settings', e);
        }
      }
    };

    window.addEventListener('eltoolkit_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('eltoolkit_settings_updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    // Sync with rust backend
    invoke('set_close_behavior', { closeToTray: settings.closeToTray }).catch(console.error);
  }, [settings.closeToTray]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const nextSettings = { ...prev, ...updates };
      localStorage.setItem('eltoolkit_settings', JSON.stringify(nextSettings));
      window.dispatchEvent(new Event('eltoolkit_settings_updated'));
      return nextSettings;
    });
  };

  return { settings, updateSettings };
}
