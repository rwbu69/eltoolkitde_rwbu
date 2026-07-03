import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Baca HTML untuk DOM
const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');

describe('Tauri Frontend Tests', () => {
    let mockCommandExecute;
    let mockCommandSpawn;
    let mockCommandOn;

    beforeEach(async () => {
        // Setup DOM
        document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

        // Mock Tauri API
        mockCommandExecute = vi.fn().mockResolvedValue({ code: 0, stdout: '{"title": "Test Video", "formats": [{"vcodec":"avc1", "height": 720}]}' });
        
        mockCommandOn = vi.fn();
        mockCommandSpawn = vi.fn().mockResolvedValue();

        const mockCommand = {
            execute: mockCommandExecute,
            spawn: mockCommandSpawn,
            stdout: { on: vi.fn((event, cb) => { if (event === 'data') cb('progress data'); }) },
            stderr: { on: vi.fn() },
            on: vi.fn((event, cb) => {
                if (event === 'close') {
                    // Simulasikan delay sedikit lalu panggil close
                    setTimeout(() => cb({ code: 0 }), 50);
                }
            })
        };

        window.__TAURI__ = {
            dialog: {
                open: vi.fn().mockResolvedValue('C:\\Test\\Output')
            },
            shell: {
                Command: {
                    sidecar: vi.fn(() => mockCommand)
                }
            },
            fs: {
                readDir: vi.fn().mockResolvedValue([{ name: 'test.mp4', isFile: true }]),
                exists: vi.fn().mockResolvedValue(true),
                mkdir: vi.fn().mockResolvedValue(),
                rename: vi.fn().mockResolvedValue(),
                remove: vi.fn().mockResolvedValue()
            }
        };

        // Karena script.js bukan module, kita evaluasi script secara global di JSDOM
        const scriptContent = fs.readFileSync(path.resolve(__dirname, 'script.js'), 'utf-8');
        // Bungkus dalam eval agar berjalan di context global window
        window.eval(scriptContent);
    });

    it('Positive Case: generateQueue harus mengambil data yt-dlp dengan benar', async () => {
        document.getElementById('yt-url').value = 'https://youtube.com/watch?v=123';
        document.getElementById('yt-browser').value = 'chrome';

        await window.generateQueue();

        const queueItems = document.getElementById('queue-items').children;
        expect(queueItems.length).toBe(1);
        
        const statusEl = document.getElementById('status-queue-item-0');
        expect(statusEl.textContent).toBe('Ready');
        
        // Memastikan command sidecar dipanggil
        expect(window.__TAURI__.shell.Command.sidecar).toHaveBeenCalledWith('bin/yt-dlp', expect.arrayContaining(['-J']));
    });

    it('Negative Case: generateQueue harus menampilkan error jika yt-dlp gagal', async () => {
        // Mock kegagalan
        window.__TAURI__.shell.Command.sidecar = vi.fn(() => ({
            execute: vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'Error info' })
        }));

        document.getElementById('yt-url').value = 'https://youtube.com/watch?v=error';
        await window.generateQueue();

        const statusEl = document.getElementById('status-queue-item-0');
        expect(statusEl.textContent).toBe('Error');
        expect(statusEl.className).toContain('status-error');
    });

    it('Positive Case: startQueue harus memproses antrean dengan benar', async () => {
        // Setup initial state (anggap generateQueue sudah jalan)
        document.getElementById('yt-output').value = 'C:\\Download';
        document.getElementById('queue-items').innerHTML = `
            <div id="queue-item-0">
                <select id="res-queue-item-0"><option value="720">720p</option></select>
                <div id="status-queue-item-0">Ready</div>
            </div>
        `;
        // Inject currentQueue array (karena currentQueue scoped di script.js, tapi karena kita butuh memanipulasinya, 
        // tunggu, currentQueue ada di scope script, tidak nempel di window. 
        // Cara terbaik: panggil generateQueue dulu)
        
        document.getElementById('yt-url').value = 'https://youtube.com/watch?v=123';
        await window.generateQueue(); // Ini akan set currentQueue
        
        document.getElementById('yt-output').value = 'C:\\Download';

        // Panggil startQueue
        await window.startQueue();

        // Pastikan spawn() dipanggil
        expect(window.__TAURI__.shell.Command.sidecar().spawn).toHaveBeenCalled();
        
        // Menunggu async close (50ms dari mock)
        await new Promise(r => setTimeout(r, 100));

        const statusEl = document.getElementById('status-queue-item-0');
        expect(statusEl.textContent).toBe('Done');
    });

    it('Memory Leak / Edge Case: event listener stdout console tidak boleh numpuk gila-gilaan', async () => {
        const consoleEl = document.getElementById('console');
        
        // Panggil appendLog 1000 kali dengan progress bar (harusnya hanya 1 span yang terus direplace)
        for (let i = 0; i < 1000; i++) {
            window.appendLog(`[download] ${i}% of 100MB at 1MB/s ETA 00:00`);
        }
        
        // Memastikan div anak di console tidak berjumlah 1000 (menghindari memory leak DOM)
        expect(consoleEl.children.length).toBeLessThan(10);
    });
});
