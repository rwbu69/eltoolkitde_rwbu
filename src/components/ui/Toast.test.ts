import { describe, it, expect, vi, afterEach } from 'vitest';
import { showToast, type ToastMessage } from './Toast';

describe('Toast deduplication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suppresses duplicate toasts dispatched within the throttle window', () => {
    let fakeTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    const dispatched: ToastMessage[] = [];
    const listener = (event: Event) => {
      dispatched.push((event as CustomEvent<ToastMessage>).detail);
    };

    window.addEventListener('toolkit-toast', listener);

    showToast('Download failed', 'error', 'Network timeout');
    showToast('Download failed', 'error', 'Network timeout'); // duplicate within 0ms
    showToast('Download failed', 'error', 'Network timeout'); // duplicate within 0ms

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].message).toBe('Download failed');

    // Advance mock time past throttle window (1500ms)
    fakeTime += 2000;

    showToast('Download failed', 'error', 'Network timeout'); // allowed now
    expect(dispatched).toHaveLength(2);

    window.removeEventListener('toolkit-toast', listener);
  });

  it('allows different toasts dispatched concurrently', () => {
    const dispatched: ToastMessage[] = [];
    const listener = (event: Event) => {
      dispatched.push((event as CustomEvent<ToastMessage>).detail);
    };

    window.addEventListener('toolkit-toast', listener);

    showToast('Item 1 added', 'success');
    showToast('Item 2 added', 'success');

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].message).toBe('Item 1 added');
    expect(dispatched[1].message).toBe('Item 2 added');

    window.removeEventListener('toolkit-toast', listener);
  });
});
