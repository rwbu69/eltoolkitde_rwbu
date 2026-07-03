const { open } = window.__TAURI__.dialog;
const { Command } = window.__TAURI__.shell;
const { readDir, exists, mkdir, rename, remove } = window.__TAURI__.fs;

// Helper custom 'path' karena plugin-path tidak ada
async function joinPath(...parts) {
    return parts.join('\\').replace(/\\\\/g, '\\');
}
function basename(p) {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1];
}
function extname(p) {
    const match = p.match(/\.[^.]+$/);
    return match ? match[0] : '';
}
function dirname(p) {
    const parts = p.split(/[\\/]/);
    parts.pop();
    return parts.join('\\');
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

const consoleEl = document.getElementById('console');
let lastProgressSpan = null;

window.appendLog = function(text) {
    const lines = text.split(/[\r\n]+/);
    
    lines.forEach(line => {
        const clean = line.trim();
        if (!clean) return;

        const isProgress = (clean.startsWith('[download]') && clean.includes('%')) || 
                           (clean.startsWith('frame=') || clean.startsWith('size='));

        if (isProgress) {
            if (!lastProgressSpan) {
                lastProgressSpan = document.createElement('div');
                consoleEl.appendChild(lastProgressSpan);
            }
            lastProgressSpan.textContent = clean;
        } else {
            lastProgressSpan = null;
            const div = document.createElement('div');
            div.textContent = clean;
            consoleEl.appendChild(div);
        }
    });

    consoleEl.scrollTop = consoleEl.scrollHeight;
}
window.clearConsole = function() {
    consoleEl.innerHTML = '';
}

window.selectFolder = async function(inputId) {
    try {
        const path = await open({ directory: true, multiple: false });
        if (path) document.getElementById(inputId).value = path;
    } catch (e) {
        alert("Gagal membuka dialog folder");
    }
}

window.selectFile = async function(inputId) {
    try {
        const path = await open({ directory: false, multiple: false });
        if (path) document.getElementById(inputId).value = path;
    } catch (e) {
        alert("Gagal membuka dialog file");
    }
}

// Queue System (YT-DLP)
let currentQueue = [];

window.generateQueue = async function() {
    const urlsRaw = document.getElementById('yt-url').value;
    const urls = urlsRaw.split('\n').map(u => u.trim()).filter(u => u);
    
    if (urls.length === 0) {
        alert("Masukkan minimal 1 URL.");
        return;
    }

    const queueList = document.getElementById('queue-list');
    const queueItems = document.getElementById('queue-items');
    queueList.style.display = 'block';
    queueItems.innerHTML = '';
    currentQueue = [];

    const browser = document.getElementById('yt-browser').value;

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const id = 'queue-item-' + i;
        currentQueue.push({ id, url, status: 'fetching' });
        
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.id = id;
        div.innerHTML = `
            <div class="url" title="${url}">${url}</div>
            <select id="res-${id}" disabled>
                <option value="">Fetching...</option>
            </select>
            <div class="status status-fetching" id="status-${id}">Fetching...</div>
        `;
        queueItems.appendChild(div);

        try {
            let fetchArgs = ['-J', '--no-check-certificate', url];
            if (browser && browser !== 'none') {
                fetchArgs.splice(1, 0, '--cookies-from-browser', browser);
            }
            const command = Command.sidecar('bin/yt-dlp', fetchArgs);
            const output = await command.execute();
            if (output.code !== 0) throw new Error("Gagal mengambil info");
            
            const data = JSON.parse(output.stdout);
            
            const selectEl = document.getElementById(`res-${id}`);
            const statusEl = document.getElementById(`status-${id}`);
            
            statusEl.textContent = 'Ready';
            statusEl.className = 'status status-ready';
            
            selectEl.innerHTML = `<option value="">Default (Best)</option>`;
            
            const formats = data.formats || [];
            const availableRes = new Map();
            formats.forEach(f => {
                if (f.vcodec !== 'none' && f.height) {
                    if (!availableRes.has(f.height)) availableRes.set(f.height, true);
                }
            });
            const sortedHeights = Array.from(availableRes.keys()).sort((a, b) => b - a);

            sortedHeights.forEach(res => {
                const opt = document.createElement('option');
                opt.value = res;
                opt.textContent = `${res}p`;
                selectEl.appendChild(opt);
            });
            selectEl.disabled = false;
            currentQueue[i].status = 'ready';
            
            const urlEl = document.querySelector(`#${id} .url`);
            const title = data.title || url;
            urlEl.textContent = title;
            urlEl.title = title;
        } catch(e) {
            document.getElementById(`status-${id}`).textContent = 'Error';
            document.getElementById(`status-${id}`).className = 'status status-error';
            currentQueue[i].status = 'error';
        }
    }
}

window.startQueue = async function() {
    const itemsToRun = currentQueue.filter(q => q.status === 'ready');
    
    if (itemsToRun.length === 0) {
        alert("Tidak ada URL yang siap diunduh dalam antrean. Klik 'Buat Antrean & Ambil Resolusi' dulu.");
        return;
    }

    const outputDir = document.getElementById('yt-output').value;
    if(!outputDir) return alert("Pilih folder output terlebih dahulu!");

    for (const item of itemsToRun) {
        document.getElementById(`status-${item.id}`).textContent = 'Running...';
        document.getElementById(`status-${item.id}`).className = 'status status-running';
        
        const resolution = document.getElementById(`res-${item.id}`).value;
        const dataPayload = {
            url: item.url,
            mode: document.getElementById('yt-mode').value,
            nameMode: document.getElementById('yt-namemode').value,
            browser: document.getElementById('yt-browser').value,
            outputDir,
            resolution: resolution || null
        };

        appendLog(`\n[QUEUE] Memulai proses: ${item.url}`);
        
        try {
            await runStream('ytdlp', dataPayload);
            document.getElementById(`status-${item.id}`).textContent = 'Done';
            document.getElementById(`status-${item.id}`).className = 'status status-done';
        } catch (e) {
            document.getElementById(`status-${item.id}`).textContent = 'Error';
            document.getElementById(`status-${item.id}`).className = 'status status-error';
        }
    }
    
    appendLog("\n[QUEUE] Semua antrean telah selesai diproses.");
}

async function runStream(module, dataPayload) {
    let cmd = '';
    let args = [];

    if (module === 'ytdlp') {
        const { url, mode, nameMode, outputDir, browser, resolution } = dataPayload;
        cmd = 'bin/yt-dlp';
        let formatArgs = [];
        if (mode === 'videoaudio') {
            if (resolution) formatArgs = ['-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/best`, '--merge-output-format', 'mp4'];
            else formatArgs = ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4'];
        } else if (mode === 'videoonly') {
            if (resolution) formatArgs = ['-f', `bestvideo[height<=${resolution}]`, '--merge-output-format', 'mp4'];
            else formatArgs = ['-f', 'bestvideo', '--merge-output-format', 'mp4'];
        } else if (mode === 'audioonly') {
            formatArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0'];
        }

        let outputTemplate = nameMode === 'autonumber' ? '%(autonumber)01d. %(title)s.%(ext)s' : '%(title)s.%(ext)s';
        
        let dlArgs = [
            '-4', '--no-check-certificate', ...formatArgs,
            '--embed-metadata', '--embed-thumbnail',
            '-o', await joinPath(outputDir, outputTemplate), url
        ];
        if (browser && browser !== 'none') {
            dlArgs.splice(1, 0, '--cookies-from-browser', browser);
        }
        args = dlArgs;
    } else if (module === 'ffmpeg-mirror') {
        cmd = 'bin/ffmpeg';
        const base = basename(dataPayload.inputFile);
        const ext = extname(dataPayload.inputFile);
        const name = base.replace(new RegExp(`\\${ext}$`), '');
        const out = await joinPath(dataPayload.outputDir, `${name} (mirror)${ext}`);
        args = ['-hide_banner', '-hwaccel', 'auto', '-y', '-i', dataPayload.inputFile, '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'hflip', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'fast', '-threads', '0', '-c:a', 'copy', out];
    } else if (module === 'ffmpeg-trim') {
        cmd = 'bin/ffmpeg';
        const base = basename(dataPayload.inputFile);
        const ext = extname(dataPayload.inputFile);
        const name = base.replace(new RegExp(`\\${ext}$`), '');
        const out = await joinPath(dataPayload.outputDir, `${name} (trimmed)${ext}`);
        args = ['-hide_banner', '-y', '-i', dataPayload.inputFile, '-ss', dataPayload.startTime, '-to', dataPayload.endTime, '-c', 'copy', out];
    }

    if (!cmd) return;

    return new Promise((resolve, reject) => {
        appendLog(`\n[START] Menjalankan perintah...`);
        const command = Command.sidecar(cmd, args);
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

// Module 2: FFmpeg Mirror
document.getElementById('form-mirror').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputFile = document.getElementById('mirror-input').value;
    const outputDir = document.getElementById('mirror-output').value;
    if(!inputFile || !outputDir) return alert("Lengkapi form!");
    await runStream('ffmpeg-mirror', { inputFile, outputDir });
});

// Module 2: FFmpeg Trim
document.getElementById('form-trim').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputFile = document.getElementById('trim-input').value;
    const startTime = document.getElementById('trim-start').value;
    const endTime = document.getElementById('trim-end').value;
    const outputDir = document.getElementById('trim-output').value;
    if(!inputFile || !outputDir || !startTime || !endTime) return alert("Lengkapi form!");
    await runStream('ffmpeg-trim', { inputFile, outputDir, startTime, endTime });
});

// Module 3: MP3 Converter
document.getElementById('form-mp3').addEventListener('submit', async (e) => {
    e.preventDefault();
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
            const command = Command.sidecar('bin/ffmpeg', ['-hide_banner', '-y', '-i', inputFile, '-map', '0:a:0?', '-vn', '-codec:a', 'libmp3lame', '-b:a', '320k', outputFile]);
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
});

// Module 4: Metadata Editor
window.toggleMetaTarget = function() {
    const mode = document.getElementById('meta-mode').value;
    const label = document.getElementById('meta-target-label');
    const btn = document.getElementById('meta-btn');
    document.getElementById('meta-input').value = '';
    
    if (mode === 'file') {
        label.textContent = 'File MP3:';
        btn.setAttribute('onclick', "selectFile('meta-input')");
        document.getElementById('meta-input').placeholder = 'Pilih file mp3...';
    } else {
        label.textContent = 'Folder MP3:';
        btn.setAttribute('onclick', "selectFolder('meta-input')");
        document.getElementById('meta-input').placeholder = 'Pilih folder yang berisi file mp3...';
    }
}

document.getElementById('form-metadata').addEventListener('submit', async (e) => {
    e.preventDefault();
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
            const command = Command.sidecar('bin/ffmpeg', ['-hide_banner', '-y', '-i', inputFile, '-map', '0:a', '-c', 'copy', '-id3v2_version', '3', '-write_id3v1', '1', ...metaArgs, tempFile]);
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
});
