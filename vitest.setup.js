import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Setup Mock DOM
const html = fs.readFileSync(path.resolve(__dirname, 'src/index.html'), 'utf-8');
document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

// Mock Tauri API secara Global
const mockCommandExecute = vi.fn().mockResolvedValue({ 
    code: 0, 
    stdout: '{"title": "Test Video", "formats": [{"vcodec":"avc1", "height": 720}]}' 
});

const mockCommandSpawn = vi.fn().mockResolvedValue();

const mockCommand = {
    execute: mockCommandExecute,
    spawn: mockCommandSpawn,
    stdout: { on: vi.fn((event, cb) => { if (event === 'data') cb('progress data\n'); }) },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
        if (event === 'close') {
            setTimeout(() => cb({ code: 0 }), 10);
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

// Fungsi bantuan untuk men-delay test
window.delay = ms => new Promise(resolve => setTimeout(resolve, ms));
