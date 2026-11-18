import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export function dispatchLog(msg: string) {
  window.dispatchEvent(new CustomEvent('toolkit-log', { detail: msg }));
}

export async function notifySuccess(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  if (granted) {
    sendNotification({ title, body });
  }
}
