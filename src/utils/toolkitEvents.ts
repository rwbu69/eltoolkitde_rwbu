import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let debugLoggingEnabled = false;

export function setDebugLoggingEnabled(enabled: boolean) {
  debugLoggingEnabled = enabled;
}

export function dispatchLog(msg: string) {
  window.dispatchEvent(new CustomEvent('toolkit-log', { detail: msg }));
}

export function dispatchDebug(scope: string, message: string, detail?: unknown) {
  if (!debugLoggingEnabled) return;
  const suffix =
    detail === undefined
      ? ''
      : ` :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  const line = `[DEBUG][${scope}] ${message}${suffix}`;
  dispatchLog(line);
  if (detail !== undefined) {
    console.debug(`[${scope}] ${message}`, detail);
  } else {
    console.debug(`[${scope}] ${message}`);
  }
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
