import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appendLog } from './utils.js';
import { generateQueue, startQueue } from './ytdlp.js';

describe('Modularized JavaScript Tests', () => {
    
    beforeEach(() => {
        // Bersihkan DOM (khusus bagian yang akan dites)
        document.getElementById('queue-items').innerHTML = '';
        document.getElementById('console').innerHTML = '';
        
        // Reset Mocks if necessary (Tauri API sudah di mock secara global di vitest.setup.js)
        vi.clearAllMocks();
    });

    it('Positive Case: generateQueue harus mengambil data yt-dlp dengan benar', async () => {
        document.getElementById('yt-url').value = 'https://youtube.com/watch?v=123';
        document.getElementById('yt-browser').value = 'chrome';

        await generateQueue();

        const queueItems = document.getElementById('queue-items').children;
        expect(queueItems.length).toBe(1);
        
        const statusEl = document.getElementById('status-queue-item-0');
        expect(statusEl.textContent).toBe('Ready');
        
        // Memastikan command sidecar dipanggil
        expect(window.__TAURI__.shell.Command.sidecar).toHaveBeenCalledWith('yt-dlp', expect.arrayContaining(['-J']));
    });

    it('Negative Case: generateQueue harus menampilkan error jika yt-dlp gagal', async () => {
        // Kita timpa mock untuk satu test case ini
        window.__TAURI__.shell.Command.sidecar.mockImplementationOnce(() => ({
            execute: vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'Error info' })
        }));

        document.getElementById('yt-url').value = 'https://youtube.com/watch?v=error';
        await generateQueue();

        const statusEl = document.getElementById('status-queue-item-0');
        expect(statusEl.textContent).toMatch(/Error/);
        expect(statusEl.className).toContain('status-error');
    });

    it('Positive Case: startQueue harus memproses antrean dengan benar', async () => {
        // Setup state terlebih dahulu dengan memanggil generateQueue
        document.getElementById('yt-url').value = 'https://youtube.com/watch?v=123';
        await generateQueue();
        
        document.getElementById('yt-output').value = 'C:\\Download';

        // Eksekusi startQueue
        await startQueue();

        // Pastikan spawn() dipanggil (karena spawn digunakan untuk download, bukan execute)
        // sidecar('yt-dlp') dipanggil 2 kali: 1 untuk generateQueue, 1 untuk startQueue
        const mockSidecar = window.__TAURI__.shell.Command.sidecar.mock.results[1].value;
        expect(mockSidecar.spawn).toHaveBeenCalled();
        
        // Tunggu promise selesai
        await window.delay(50);

        const statusEl = document.getElementById('status-queue-item-0');
        expect(statusEl.textContent).toBe('Done');
    });

    it('Memory Leak / Edge Case: event listener stdout console tidak boleh numpuk gila-gilaan (max 500)', () => {
        const consoleEl = document.getElementById('console');
        
        // Panggil appendLog 600 kali (bukan progress)
        for (let i = 0; i < 600; i++) {
            appendLog(`Log biasa ke-${i}`);
        }
        
        // Harus dibatasi tepat 500 anak (atau kurang jika ditambahkan baris kosong)
        expect(consoleEl.children.length).toBe(500);

        // Test behavior dari elemen progress bar
        consoleEl.innerHTML = '';
        for (let i = 0; i < 1000; i++) {
            appendLog(`[download] ${i}% of 100MB at 1MB/s ETA 00:00`);
        }
        
        // Progress bar harus mereplace span yang sama terus, jangan bikin elemen baru
        expect(consoleEl.children.length).toBeLessThan(10);
    });
});
