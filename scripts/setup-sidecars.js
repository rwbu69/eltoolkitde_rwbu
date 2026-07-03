const fs = require('fs');
const path = require('path');
const https = require('https');
const ffmpegStatic = require('ffmpeg-static');

const platform = process.platform;
let ffmpegTarget, ytdlpTarget;
let ytdlpUrl;

if (platform === 'win32') {
    ffmpegTarget = 'ffmpeg-x86_64-pc-windows-msvc.exe';
    ytdlpTarget = 'yt-dlp-x86_64-pc-windows-msvc.exe';
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
} else if (platform === 'darwin') {
    ffmpegTarget = 'ffmpeg-universal-apple-darwin';
    // Mac M1/M2 butuh universal-apple-darwin
    ytdlpTarget = 'yt-dlp-universal-apple-darwin';
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
} else {
    ffmpegTarget = 'ffmpeg-x86_64-unknown-linux-gnu';
    ytdlpTarget = 'yt-dlp-x86_64-unknown-linux-gnu';
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
}

const binDir = path.join(__dirname, '..', 'src-tauri', 'bin');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

// 1. Copy FFmpeg dari module ffmpeg-static
const destFfmpeg = path.join(binDir, ffmpegTarget);
if (!fs.existsSync(destFfmpeg)) {
    fs.copyFileSync(ffmpegStatic, destFfmpeg);
    fs.chmodSync(destFfmpeg, 0o755);
    console.log(`[OK] Copied ffmpeg to ${destFfmpeg}`);
} else {
    console.log(`[SKIP] ffmpeg already exists at ${destFfmpeg}`);
}

// 2. Download yt-dlp secara dinamis mengikuti redirect
const destYtdlp = path.join(binDir, ytdlpTarget);

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`[SKIP] yt-dlp already exists at ${dest}`);
            return resolve();
        }
        
        console.log(`[INFO] Downloading yt-dlp from ${url}...`);
        const file = fs.createWriteStream(dest);
        
        const request = https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Ikuti redirect
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            } else if (response.statusCode !== 200) {
                reject(new Error(`Failed to download, status code: ${response.statusCode}`));
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    fs.chmodSync(dest, 0o755);
                    console.log(`[OK] Downloaded yt-dlp to ${dest}`);
                    resolve();
                });
            }
        });
        
        request.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

downloadFile(ytdlpUrl, destYtdlp).catch(err => {
    console.error(`[ERROR] Failed to download yt-dlp:`, err);
    process.exit(1);
});
