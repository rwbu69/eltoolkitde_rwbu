const { Command } = window.__TAURI__.shell;
import { appendLog } from './utils.js';

let currentQueue = [];

export async function generateQueue() {
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

    const cookieMode = document.getElementById('yt-cookie-mode').value;
    const browser = document.getElementById('yt-browser').value;
    const cookieFile = document.getElementById('yt-cookie-file').value;

    if (cookieMode === 'file' && !cookieFile) {
        alert("Pilih file cookies.txt terlebih dahulu!");
        return;
    }

    const { invoke } = window.__TAURI__.core;
    let ffmpegLocation = null;
    try {
        ffmpegLocation = await invoke('setup_ffmpeg_location');
    } catch (e) {
        console.warn("Gagal setup ffmpeg location:", e);
    }

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const id = 'queue-item-' + i;
        currentQueue.push({ id, url, status: 'fetching' });
        
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.id = id;
        div.innerHTML = `
            <div style="flex:1; margin-right: 15px; overflow: hidden;">
                <div class="url" title="${url}" style="text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;">${url}</div>
                <div class="progress-container" id="prog-cont-${id}">
                    <div class="progress-bar" id="prog-bar-${id}"></div>
                    <div class="progress-text" id="prog-text-${id}">
                        <span id="prog-pct-${id}">0%</span>
                        <span id="prog-speed-${id}">--</span>
                        <span id="prog-eta-${id}">ETA: --</span>
                    </div>
                </div>
            </div>
            <select id="res-${id}" disabled style="${document.getElementById('yt-mode').value === 'audioonly' ? 'display:none;' : ''}">
                <option value="">Fetching...</option>
            </select>
            <div class="status status-fetching" id="status-${id}">Fetching...</div>
        `;
        queueItems.appendChild(div);

        try {
            let fetchArgs = ['--encoding', 'utf-8', '-J', '--no-check-certificate', url];
            if (cookieMode === 'browser' && browser) {
                fetchArgs.splice(2, 0, '--cookies-from-browser', browser);
            } else if (cookieMode === 'file' && cookieFile) {
                fetchArgs.splice(2, 0, '--cookies', cookieFile);
            }
            
            if (ffmpegLocation) {
                fetchArgs.push('--ffmpeg-location', ffmpegLocation);
                const isWin = navigator.userAgent.toLowerCase().includes('windows');
                const nodeBinary = isWin ? 'node.exe' : 'node';
                const sep = isWin ? '\\' : '/';
                fetchArgs.push('--js-runtimes', `node:${ffmpegLocation}${sep}${nodeBinary}`);
            }

            const command = Command.sidecar('yt-dlp', fetchArgs);
            const output = await command.execute();
            if (output.code !== 0) throw new Error("Gagal mengambil info");
            
            const data = JSON.parse(output.stdout);
            
            const selectEl = document.getElementById(`res-${id}`);
            const statusEl = document.getElementById(`status-${id}`);
            
            statusEl.textContent = 'Ready';
            statusEl.className = 'status status-ready';
            
            selectEl.innerHTML = `
                <option value="best">Preset: Best (Highest)</option>
                <option value="higher">Preset: Higher (480p - 720p)</option>
                <option value="low">Preset: Low (144p - 360p)</option>
                <optgroup label="Resolusi Spesifik">
            `;
            
            const formats = data.formats || [];
            const availableRes = new Map();
            let audioAbr = '';
            formats.forEach(f => {
                if (f.vcodec !== 'none' && f.height) {
                    if (!availableRes.has(f.height)) availableRes.set(f.height, true);
                }
                if (f.vcodec === 'none' && f.acodec !== 'none' && f.abr) {
                    if (!audioAbr || f.abr > audioAbr) audioAbr = f.abr;
                }
            });
            const sortedHeights = Array.from(availableRes.keys()).sort((a, b) => b - a);

            const optGroup = selectEl.querySelector('optgroup');
            sortedHeights.forEach(res => {
                const opt = document.createElement('option');
                opt.value = res;
                opt.textContent = `${res}p`;
                optGroup.appendChild(opt);
            });
            selectEl.disabled = false;
            currentQueue[i].status = 'ready';
            
            const urlEl = document.querySelector(`#${id} .url`);
            const title = data.title || url;
            const abrText = audioAbr ? ` (Audio: ~${Math.round(audioAbr)}kbps)` : '';
            urlEl.textContent = title + abrText;
            urlEl.title = title + abrText;
        } catch(e) {
            const errMsg = e.message || String(e);
            console.error("YTDLP Error:", e);
            document.getElementById(`status-${id}`).textContent = 'Error: ' + errMsg.substring(0, 40);
            document.getElementById(`status-${id}`).className = 'status status-error';
            document.getElementById(`status-${id}`).title = errMsg;
            currentQueue[i].status = 'error';
        }
    }
}

export async function startQueue() {
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
            id: item.id,
            url: item.url,
            mode: document.getElementById('yt-mode').value,
            nameMode: document.getElementById('yt-namemode').value,
            cookieMode: document.getElementById('yt-cookie-mode').value,
            browser: document.getElementById('yt-browser').value,
            cookieFile: document.getElementById('yt-cookie-file').value,
            outputDir,
            resolution: resolution || null
        };

        appendLog(`\n[QUEUE] Memulai proses: ${item.url}`);
        
        try {
            await runYtdlpStream(dataPayload);
            document.getElementById(`status-${item.id}`).textContent = 'Done';
            document.getElementById(`status-${item.id}`).className = 'status status-done';
        } catch (e) {
            const errMsg = e.message || String(e);
            console.error("YTDLP Download Error:", e);
            appendLog(`[ERROR] Gagal memproses ${item.url}: ${errMsg}`);
            document.getElementById(`status-${item.id}`).textContent = 'Error: ' + errMsg.substring(0, 30);
            document.getElementById(`status-${item.id}`).className = 'status status-error';
            document.getElementById(`status-${item.id}`).title = errMsg;
        }
    }
    
    appendLog("\n[QUEUE] Semua antrean telah selesai diproses.");
}

async function runYtdlpStream(dataPayload) {
    const { id, url, mode, nameMode, outputDir, cookieMode, browser, cookieFile, resolution } = dataPayload;
    
    const { invoke } = window.__TAURI__.core;
    let ffmpegLocation = null;
    try {
        ffmpegLocation = await invoke('setup_ffmpeg_location');
    } catch (e) {
        console.warn("Gagal setup ffmpeg location:", e);
    }

    let formatArgs = [];
    if (mode === 'videoaudio') {
        if (resolution === 'low') formatArgs = ['-f', 'bestvideo[height<=360]+bestaudio/best', '--merge-output-format', 'mp4'];
        else if (resolution === 'higher') formatArgs = ['-f', 'bestvideo[height<=720]+bestaudio/best', '--merge-output-format', 'mp4'];
        else if (resolution === 'best' || !resolution) formatArgs = ['-f', 'bestvideo+bestaudio/best', '--merge-output-format', 'mp4'];
        else formatArgs = ['-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/best`, '--merge-output-format', 'mp4'];
    } else if (mode === 'videoonly') {
        if (resolution === 'low') formatArgs = ['-f', 'bestvideo[height<=360]', '--merge-output-format', 'mp4'];
        else if (resolution === 'higher') formatArgs = ['-f', 'bestvideo[height<=720]', '--merge-output-format', 'mp4'];
        else if (resolution === 'best' || !resolution) formatArgs = ['-f', 'bestvideo', '--merge-output-format', 'mp4'];
        else formatArgs = ['-f', `bestvideo[height<=${resolution}]`, '--merge-output-format', 'mp4'];
    } else if (mode === 'audioonly') {
        formatArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0'];
    }

    let template = nameMode === 'autonumber' ? '%(autonumber)s. %(title)s.%(ext)s' : '%(title)s.%(ext)s';

    let dlArgs = ['--encoding', 'utf-8', '--newline', '--progress-delta', '1', ...formatArgs, '-o', template, '-P', outputDir];
    
    if (ffmpegLocation) {
        dlArgs.push('--ffmpeg-location', ffmpegLocation);
        
        // Pass JS runtime
        const isWin = navigator.userAgent.toLowerCase().includes('windows');
        const nodeBinary = isWin ? 'node.exe' : 'node';
        const sep = isWin ? '\\' : '/';
        dlArgs.push('--js-runtimes', `node:${ffmpegLocation}${sep}${nodeBinary}`);
    }

    if (cookieMode === 'browser' && browser) {
        dlArgs.push('--cookies-from-browser', browser);
    } else if (cookieMode === 'file' && cookieFile) {
        dlArgs.push('--cookies', cookieFile);
    }

    dlArgs.push('--no-check-certificate', url);

    return new Promise((resolve, reject) => {
        appendLog(`\n[START] Menjalankan yt-dlp...`);
        const command = Command.sidecar('yt-dlp', dlArgs);
        
        const progCont = document.getElementById(`prog-cont-${id}`);
        const progBar = document.getElementById(`prog-bar-${id}`);
        const progPct = document.getElementById(`prog-pct-${id}`);
        const progSpeed = document.getElementById(`prog-speed-${id}`);
        const progEta = document.getElementById(`prog-eta-${id}`);
        
        if (progCont) progCont.style.display = 'block';

        let lastUpdate = 0;

        command.stdout.on('data', line => { 
            if(!line.trim()) return;
            
            const dlMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of[ ~]+([^ ]+)\s+at\s+([^ ]+)\s+ETA\s+([^ ]+)/);
            if (dlMatch) {
                const now = Date.now();
                if (now - lastUpdate > 3000 || parseFloat(dlMatch[1]) >= 100) {
                    if (progBar) {
                        progBar.style.width = `${dlMatch[1]}%`;
                        progPct.textContent = `${dlMatch[1]}%`;
                        progSpeed.textContent = dlMatch[3];
                        progEta.textContent = `ETA: ${dlMatch[4]}`;
                    }
                    lastUpdate = now;
                }
            } else if (line.includes('[download] Destination:') || line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
                appendLog(`[INFO] ${line.trim()}`);
            } else if (line.toLowerCase().includes('error') || line.toLowerCase().includes('warning')) {
                appendLog(`[YT-DLP] ${line.trim()}`);
            }
        });
        command.stderr.on('data', line => { 
            if(line.trim()) appendLog(`[YT-DLP ERROR/WARN] ${line.trim()}`); 
        });
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
