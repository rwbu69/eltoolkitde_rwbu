const express = require('express');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/api/select-folder', (req, res) => {
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $form = New-Object System.Windows.Forms.Form
        $form.TopMost = $true
        $form.ShowInTaskbar = $false
        $form.WindowState = 'Minimized'
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Pilih Folder"
        $dialog.ShowNewFolderButton = $true
        if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $dialog.SelectedPath
        }
    `;
    const ps = spawn('powershell', ['-NoProfile', '-Command', psScript]);
    let out = '';
    ps.stdout.on('data', data => out += data.toString());
    ps.on('close', () => res.json({ path: out.trim() }));
});

app.get('/api/select-file', (req, res) => {
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $form = New-Object System.Windows.Forms.Form
        $form.TopMost = $true
        $form.ShowInTaskbar = $false
        $form.WindowState = 'Minimized'
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = "Pilih File"
        if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $dialog.FileName
        }
    `;
    const ps = spawn('powershell', ['-NoProfile', '-Command', psScript]);
    let out = '';
    ps.stdout.on('data', data => out += data.toString());
    ps.on('close', () => res.json({ path: out.trim() }));
});

app.post('/api/ytdlp/info', (req, res) => {
    const { url, browser } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    let cookieArgs = [];
    const cookieFile = path.join(__dirname, '..', 'cookies.txt');
    if (fs.existsSync(cookieFile)) {
        cookieArgs = ['--cookies', cookieFile];
    } else {
        cookieArgs = ['--cookies-from-browser', browser || 'chrome'];
    }

    const args = ['-J', ...cookieArgs, '--no-check-certificate', url];
    
    execFile('yt-dlp', args, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: 'Gagal mengambil info video. Pastikan URL valid.' });
        }
        try {
            const data = JSON.parse(stdout);
            const formats = data.formats || [];
            
            const availableRes = new Map();
            formats.forEach(f => {
                if (f.vcodec !== 'none' && f.height) {
                    if (!availableRes.has(f.height)) availableRes.set(f.height, true);
                }
            });
            
            const sortedHeights = Array.from(availableRes.keys()).sort((a, b) => b - a);
            res.json({ title: data.title || url, resolutions: sortedHeights });
        } catch (e) {
            res.status(500).json({ error: 'Gagal parse JSON dari yt-dlp' });
        }
    });
});

app.post('/api/run', (req, res) => {
    const { module, data } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (msg) => {
        res.write(`data: ${JSON.stringify({ text: msg })}\n\n`);
    };

    if (module === 'ffmpeg-mp3') {
        const { sourceFolder, outputRoot } = data;
        if (!sourceFolder || !outputRoot) {
            sendLog("Error: Source Folder atau Output Root kosong.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }

        const srcName = path.basename(sourceFolder);
        const destFolder = path.join(outputRoot, 'output_mp3', `${srcName}_mp3`);
        
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
        
        const files = fs.readdirSync(sourceFolder).filter(f => /\.(mp4|mkv|avi|mov|webm|wav|m4a|aac|flac|ogg|wma)$/i.test(f));
        if (files.length === 0) {
            sendLog("Error: Tidak ada file media di folder tersebut.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }

        sendLog(`[INFO] Ditemukan ${files.length} file. Mulai konversi...`);
        let i = 0;
        const runNext = () => {
            if (i >= files.length) {
                sendLog("\n[SUCCESS] Selesai memproses semua file.");
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                return res.end();
            }
            
            const file = files[i];
            const baseName = path.parse(file).name;
            const inputFile = path.join(sourceFolder, file);
            const outputFile = path.join(destFolder, `${baseName}.mp3`);
            
            if (fs.existsSync(outputFile)) {
                sendLog(`[SKIP] File sudah ada: ${file}`);
                i++; runNext(); return;
            }
            
            sendLog(`\n[PROCESS] Konversi: ${file} ...`);
            const p = spawn('ffmpeg', ['-hide_banner', '-y', '-i', inputFile, '-map', '0:a:0?', '-vn', '-codec:a', 'libmp3lame', '-b:a', '320k', outputFile]);
            
            p.stdout.on('data', d => { if(d.toString().trim()) sendLog(d.toString()); });
            p.stderr.on('data', d => { if(d.toString().trim()) sendLog(d.toString()); });
            p.on('close', code => {
                if(code !== 0) sendLog(`[ERROR] Gagal konversi ${file}`);
                else sendLog(`[DONE] ${file}`);
                i++; runNext();
            });
        };
        runNext();
        return;
    } else if (module === 'ffmpeg-metadata') {
        const { mode, inputPath, title, artist, album, year } = data;
        if (!inputPath) {
            sendLog("Error: Path target belum dipilih.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }
        
        let filesToProcess = [];
        if (mode === 'file') {
            filesToProcess.push(inputPath);
        } else {
            if (fs.existsSync(inputPath)) {
                const files = fs.readdirSync(inputPath).filter(f => f.toLowerCase().endsWith('.mp3'));
                files.forEach(f => filesToProcess.push(path.join(inputPath, f)));
            }
        }
        
        if (filesToProcess.length === 0) {
            sendLog("Error: Tidak ada file MP3 yang ditemukan di target.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }
        
        let metaArgs = [];
        if (title) metaArgs.push('-metadata', `title=${title}`);
        if (artist) metaArgs.push('-metadata', `artist=${artist}`);
        if (album) metaArgs.push('-metadata', `album=${album}`);
        if (year) metaArgs.push('-metadata', `date=${year}`);
        
        sendLog(`[INFO] Ditemukan ${filesToProcess.length} file MP3 untuk dimodifikasi.`);
        let i = 0;
        
        const processNext = () => {
            if (i >= filesToProcess.length) {
                sendLog("\n[SUCCESS] Selesai menulis metadata untuk semua file.");
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                return res.end();
            }
            
            const inputFile = filesToProcess[i];
            const baseName = path.parse(inputFile).name;
            const dir = path.dirname(inputFile);
            const tempFile = path.join(dir, `${baseName}_temp.mp3`);
            
            sendLog(`[PROCESS] Menulis metadata untuk: ${path.basename(inputFile)}`);
            const p = spawn('ffmpeg', ['-hide_banner', '-y', '-i', inputFile, '-map', '0:a', '-c', 'copy', '-id3v2_version', '3', '-write_id3v1', '1', ...metaArgs, tempFile]);
            
            p.stdout.on('data', d => { if(d.toString().trim()) sendLog(d.toString()); });
            p.stderr.on('data', d => { if(d.toString().trim()) sendLog(d.toString()); });
            p.on('close', code => {
                if (code !== 0) {
                    sendLog(`[ERROR] Gagal menulis metadata`);
                    if(fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } else {
                    fs.renameSync(tempFile, inputFile);
                    sendLog(`[DONE] ${path.basename(inputFile)}`);
                }
                i++;
                processNext();
            });
        };
        processNext();
        return;
    }

    let cmd = '';
    let args = [];

    if (module === 'ytdlp') {
        const { url, mode, nameMode, outputDir, browser, resolution } = data;
        if (!url || !outputDir) {
            sendLog("Error: URL atau Output Folder kosong.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }

        cmd = 'yt-dlp';
        let formatArgs = [];
        if (mode === 'videoaudio') {
            if (resolution) {
                formatArgs = ['-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/best`, '--merge-output-format', 'mp4'];
            } else {
                formatArgs = ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4'];
            }
        } else if (mode === 'videoonly') {
            if (resolution) {
                formatArgs = ['-f', `bestvideo[height<=${resolution}]`, '--merge-output-format', 'mp4'];
            } else {
                formatArgs = ['-f', 'bestvideo', '--merge-output-format', 'mp4'];
            }
        } else if (mode === 'audioonly') {
            formatArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0'];
        }

        let outputTemplate = nameMode === 'autonumber' ? '%(autonumber)01d. %(title)s.%(ext)s' : '%(title)s.%(ext)s';

        let cookieArgs = [];
        const cookieFile = path.join(__dirname, '..', 'cookies.txt');
        if (fs.existsSync(cookieFile)) {
            sendLog("[INFO] Menggunakan file cookies.txt");
            cookieArgs = ['--cookies', cookieFile];
        } else {
            cookieArgs = ['--cookies-from-browser', browser || 'chrome'];
        }

        args = [
            '-4', ...cookieArgs,
            '--js-runtimes', 'node',
            '--remote-components', 'ejs:github',
            '--extractor-args', 'youtube:player_client=default,web_embedded',
            '--no-check-certificate',
            ...formatArgs,
            '--embed-metadata', '--embed-thumbnail',
            '-o', path.join(outputDir, outputTemplate),
            url
        ];
    } else if (module === 'ffmpeg-mirror') {
        const { inputFile, outputDir } = data;
        if (!inputFile || !outputDir) {
            sendLog("Error: Parameter tidak lengkap.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`); return res.end();
        }
        const baseName = path.parse(inputFile).name;
        const ext = path.parse(inputFile).ext;
        const outputFile = path.join(outputDir, `${baseName} (mirror)${ext}`);
        
        cmd = 'ffmpeg';
        args = ['-hide_banner', '-hwaccel', 'auto', '-y', '-i', inputFile, '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'hflip', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'fast', '-threads', '0', '-c:a', 'copy', outputFile];
    } else if (module === 'ffmpeg-trim') {
        const { inputFile, outputDir, startTime, endTime } = data;
        if (!inputFile || !outputDir || !startTime || !endTime) {
            sendLog("Error: Parameter Trimming tidak lengkap.");
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`); return res.end();
        }
        const baseName = path.parse(inputFile).name;
        const ext = path.parse(inputFile).ext;
        const outputFile = path.join(outputDir, `${baseName} (trimmed)${ext}`);
        
        cmd = 'ffmpeg';
        args = ['-hide_banner', '-y', '-i', inputFile, '-ss', startTime, '-to', endTime, '-c', 'copy', outputFile];
    }

    sendLog(`\n[START] Menjalankan perintah...`);
    const proc = spawn(cmd, args);

    proc.stdout.on('data', (d) => { const text = d.toString(); if(text.trim()) sendLog(text); });
    proc.stderr.on('data', (d) => { const text = d.toString(); if(text.trim()) sendLog(text); });

    proc.on('close', (code) => {
        sendLog(`\n[DONE] Selesai dengan kode ${code}`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`ElToolkitDeRWBU Web GUI running on http://localhost:${PORT}`);
});
