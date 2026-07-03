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
function appendLog(text) {
    const span = document.createElement('span');
    span.textContent = text + '\n';
    consoleEl.appendChild(span);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}
function clearConsole() {
    consoleEl.innerHTML = '';
}

async function selectFolder(inputId) {
    try {
        const res = await fetch('/api/select-folder');
        const data = await res.json();
        if (data.path) document.getElementById(inputId).value = data.path;
    } catch (e) {
        alert("Gagal membuka dialog folder");
    }
}

async function selectFile(inputId) {
    try {
        const res = await fetch('/api/select-file');
        const data = await res.json();
        if (data.path) document.getElementById(inputId).value = data.path;
    } catch (e) {
        alert("Gagal membuka dialog file");
    }
}

// Queue System (YT-DLP)
let currentQueue = [];

async function generateQueue() {
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
        
        // Render UI item
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

        // Fetch resolution
        try {
            const res = await fetch('/api/ytdlp/info', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ url, browser })
            });
            const data = await res.json();
            
            const selectEl = document.getElementById(`res-${id}`);
            const statusEl = document.getElementById(`status-${id}`);
            
            if (data.error) {
                statusEl.textContent = 'Error';
                statusEl.className = 'status status-error';
                selectEl.innerHTML = `<option value="">Error</option>`;
                currentQueue[i].status = 'error';
            } else {
                statusEl.textContent = 'Ready';
                statusEl.className = 'status status-ready';
                
                selectEl.innerHTML = `<option value="">Default (Best)</option>`;
                data.resolutions.forEach(res => {
                    const opt = document.createElement('option');
                    opt.value = res;
                    opt.textContent = `${res}p`;
                    selectEl.appendChild(opt);
                });
                selectEl.disabled = false;
                currentQueue[i].status = 'ready';
                
                // update text to title
                const urlEl = document.querySelector(`#${id} .url`);
                urlEl.textContent = data.title;
                urlEl.title = data.title;
            }
        } catch(e) {
            document.getElementById(`status-${id}`).textContent = 'Error';
            document.getElementById(`status-${id}`).className = 'status status-error';
            currentQueue[i].status = 'error';
        }
    }
}

async function startQueue() {
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
    return new Promise(async (resolve, reject) => {
        try {
            const res = await fetch('/api/run', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ module, data: dataPayload })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');
                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const parsed = JSON.parse(line.substring(6));
                            if (parsed.text) appendLog(parsed.text);
                            if (parsed.done) {
                                resolve();
                                return;
                            }
                        } catch(e) {}
                    }
                }
            }
            resolve();
        } catch (e) {
            appendLog(`[ERROR] Request gagal: ${e.message}`);
            reject(e);
        }
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
    await runStream('ffmpeg-mp3', { sourceFolder, outputRoot });
});

// Module 4: Metadata Editor
function toggleMetaTarget() {
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
    const payload = {
        mode: document.getElementById('meta-mode').value,
        inputPath,
        title: document.getElementById('meta-title').value,
        artist: document.getElementById('meta-artist').value,
        album: document.getElementById('meta-album').value,
        year: document.getElementById('meta-year').value
    };
    await runStream('ffmpeg-metadata', payload);
});
