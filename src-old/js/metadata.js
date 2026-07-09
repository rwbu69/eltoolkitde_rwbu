const { Command } = window.__TAURI__.shell;
const { readDir, exists, rename, remove } = window.__TAURI__.fs;
import { appendLog, joinPath, basename, dirname, selectFile, selectFolder } from './utils.js';

export function toggleMetaTarget() {
    const mode = document.getElementById('meta-mode').value;
    const label = document.getElementById('meta-target-label');
    const btn = document.getElementById('meta-btn');
    document.getElementById('meta-input').value = '';
    
    // We update the click listener dynamically since we removed inline onclick from HTML
    btn.onclick = mode === 'file' ? 
        () => selectFile('meta-input') : 
        () => selectFolder('meta-input');
        
    if (mode === 'file') {
        label.textContent = 'File MP3:';
        document.getElementById('meta-input').placeholder = 'Pilih file mp3...';
    } else {
        label.textContent = 'Folder MP3:';
        document.getElementById('meta-input').placeholder = 'Pilih folder yang berisi file mp3...';
    }
}

export async function processMetadata() {
    const inputPath = document.getElementById('meta-input').value;
    if(!inputPath) return alert("Pilih target file/folder MP3 terlebih dahulu!");
    
    const mode = document.getElementById('meta-mode').value;
    const title = document.getElementById('meta-title').value;
    const artist = document.getElementById('meta-artist').value;
    const album = document.getElementById('meta-album').value;
    const year = document.getElementById('meta-year').value;
    
    let filesToProcess = [];
    if (mode === 'file') {
        filesToProcess.push(inputPath);
    } else {
        if (await exists(inputPath)) {
            const entries = await readDir(inputPath);
            for (const entry of entries) {
                if (entry.isFile && entry.name.toLowerCase().endsWith('.mp3')) {
                    filesToProcess.push(await joinPath(inputPath, entry.name));
                }
            }
        }
    }
    
    if (filesToProcess.length === 0) {
        appendLog("Error: Tidak ada file MP3 yang ditemukan di target.");
        return;
    }
    
    let metaArgs = [];
    if (title) metaArgs.push('-metadata', `title=${title}`);
    if (artist) metaArgs.push('-metadata', `artist=${artist}`);
    if (album) metaArgs.push('-metadata', `album=${album}`);
    if (year) metaArgs.push('-metadata', `date=${year}`);
    
    appendLog(`[INFO] Ditemukan ${filesToProcess.length} file MP3 untuk dimodifikasi.`);
    for (const inputFile of filesToProcess) {
        const baseName = basename(inputFile).replace(/\.[^.]+$/, '');
        const dir = dirname(inputFile);
        const tempFile = await joinPath(dir, `${baseName}_temp.mp3`);
        
        appendLog(`[PROCESS] Menulis metadata untuk: ${basename(inputFile)}`);
        await new Promise((resolve) => {
            const command = Command.sidecar('ffmpeg', ['-hide_banner', '-y', '-i', inputFile, '-map', '0:a', '-c', 'copy', '-id3v2_version', '3', '-write_id3v1', '1', ...metaArgs, tempFile]);
            command.stdout.on('data', d => { if(d.trim()) appendLog(d); });
            command.stderr.on('data', d => { if(d.trim()) appendLog(d); });
            command.on('close', async (data) => {
                if (data.code !== 0) {
                    appendLog(`[ERROR] Gagal menulis metadata`);
                    if (await exists(tempFile)) await remove(tempFile);
                } else {
                    await rename(tempFile, inputFile);
                    appendLog(`[DONE] ${basename(inputFile)}`);
                }
                resolve();
            });
            command.spawn().catch(resolve);
        });
    }
    appendLog("\n[SUCCESS] Selesai menulis metadata untuk semua file.");
}
