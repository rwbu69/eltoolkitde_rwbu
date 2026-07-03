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
            let fetchArgs = ['--encoding', 'utf-8', '-J', '--no-check-certificate', url];
            if (cookieMode === 'browser' && browser) {
                fetchArgs.splice(2, 0, '--cookies-from-browser', browser);
            } else if (cookieMode === 'file' && cookieFile) {
                fetchArgs.splice(2, 0, '--cookies', cookieFile);
            }
            const command = Command.sidecar('yt-dlp', fetchArgs);
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
    const { url, mode, nameMode, outputDir, cookieMode, browser, cookieFile, resolution } = dataPayload;
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

    let template = nameMode === 'autonumber' ? '%(autonumber)s. %(title)s.%(ext)s' : '%(title)s.%(ext)s';

    let dlArgs = ['--encoding', 'utf-8', '--newline', '--progress-delta', '1', ...formatArgs, '-o', template, '-P', outputDir];

    if (cookieMode === 'browser' && browser) {
        dlArgs.push('--cookies-from-browser', browser);
    } else if (cookieMode === 'file' && cookieFile) {
        dlArgs.push('--cookies', cookieFile);
    }

    dlArgs.push('--no-check-certificate', url);

    return new Promise((resolve, reject) => {
        appendLog(`\n[START] Menjalankan yt-dlp...`);
        const command = Command.sidecar('yt-dlp', dlArgs);
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
