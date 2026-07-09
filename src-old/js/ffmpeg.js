const { Command } = window.__TAURI__.shell;
const { readDir, exists, mkdir } = window.__TAURI__.fs;
import { appendLog, joinPath, basename, extname } from './utils.js';

export async function processMirror() {
    const inputFile = document.getElementById('mirror-input').value;
    const outputDir = document.getElementById('mirror-output').value;
    if(!inputFile || !outputDir) return alert("Lengkapi form!");

    const base = basename(inputFile);
    const ext = extname(inputFile);
    const name = base.replace(new RegExp(`\\${ext}$`), '');
    const out = await joinPath(outputDir, `${name} (mirrored)${ext}`);
    const args = ['-hide_banner', '-y', '-i', inputFile, '-vf', 'hflip', '-c:a', 'copy', out];

    await runFfmpeg(args, "Memulai Mirror");
}

export async function processTrim() {
    const inputFile = document.getElementById('trim-input').value;
    const startTime = document.getElementById('trim-start').value;
    const endTime = document.getElementById('trim-end').value;
    const outputDir = document.getElementById('trim-output').value;
    if(!inputFile || !outputDir || !startTime || !endTime) return alert("Lengkapi form!");

    const base = basename(inputFile);
    const ext = extname(inputFile);
    const name = base.replace(new RegExp(`\\${ext}$`), '');
    const out = await joinPath(outputDir, `${name} (trimmed)${ext}`);
    const args = ['-hide_banner', '-y', '-i', inputFile, '-ss', startTime, '-to', endTime, '-c', 'copy', out];

    await runFfmpeg(args, "Memulai Trim");
}

export async function processMp3Convert() {
    const sourceFolder = document.getElementById('mp3-input').value;
    const outputRoot = document.getElementById('mp3-output').value;
    if(!sourceFolder || !outputRoot) return alert("Lengkapi form!");
    
    const srcName = basename(sourceFolder);
    const destFolder = await joinPath(outputRoot, 'output_mp3', `${srcName}_mp3`);
    
    if (!(await exists(destFolder))) await mkdir(destFolder, { recursive: true });
    
    const entries = await readDir(sourceFolder);
    const files = entries.filter(e => e.isFile && /\.(mp4|mkv|avi|mov|webm|wav|m4a|aac|flac|ogg|wma)$/i.test(e.name)).map(e => e.name);
    
    if (files.length === 0) {
        appendLog("Error: Tidak ada file media di folder tersebut.");
        return;
    }

    appendLog(`[INFO] Ditemukan ${files.length} file. Mulai konversi...`);
    for (const file of files) {
        const baseName = file.replace(/\.[^.]+$/, '');
        const inputFile = await joinPath(sourceFolder, file);
        const outputFile = await joinPath(destFolder, `${baseName}.mp3`);
        
        if (await exists(outputFile)) {
            appendLog(`[SKIP] File sudah ada: ${file}`);
            continue;
        }
        
        appendLog(`\n[PROCESS] Konversi: ${file} ...`);
        await new Promise((resolve, reject) => {
            const command = Command.sidecar('ffmpeg', ['-hide_banner', '-y', '-i', inputFile, '-map', '0:a:0?', '-vn', '-codec:a', 'libmp3lame', '-b:a', '320k', outputFile]);
            command.stdout.on('data', d => { if(d.trim()) appendLog(d); });
            command.stderr.on('data', d => { if(d.trim()) appendLog(d); });
            command.on('close', data => {
                if(data.code !== 0) appendLog(`[ERROR] Gagal konversi ${file}`);
                else appendLog(`[DONE] ${file}`);
                resolve();
            });
            command.spawn().catch(resolve);
        });
    }
    appendLog("\n[SUCCESS] Selesai memproses semua file.");
}

async function runFfmpeg(args, logMessage) {
    return new Promise((resolve, reject) => {
        appendLog(`\n[START] ${logMessage}...`);
        const command = Command.sidecar('ffmpeg', args);
        command.stdout.on('data', line => { if(line.trim()) appendLog(line); });
        command.stderr.on('data', line => { if(line.trim()) appendLog(line); });
        command.on('close', data => {
            appendLog(`\n[DONE] Selesai dengan kode ${data.code}`);
            if (data.code === 0) resolve(); else reject();
        });
        command.on('error', error => {
            appendLog(`[ERROR] ${error}`);
            reject(error);
        });
        command.spawn().catch(reject);
    });
}
