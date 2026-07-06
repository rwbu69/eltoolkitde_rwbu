const fs = require('fs');
const path = require('path');
const https = require('https');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

const platform = process.platform;
let ffmpegTargets = [], ffprobeTargets = [], nodeTargets = [], ytdlpTargets = [];
let ytdlpUrl;

if (platform === 'win32') {
    ffmpegTargets = ['ffmpeg-x86_64-pc-windows-msvc.exe'];
    ffprobeTargets = ['ffprobe-x86_64-pc-windows-msvc.exe'];
    nodeTargets = ['node-x86_64-pc-windows-msvc.exe'];
    ytdlpTargets = ['yt-dlp-x86_64-pc-windows-msvc.exe'];
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
} else if (platform === 'darwin') {
    ffmpegTargets = ['ffmpeg-aarch64-apple-darwin', 'ffmpeg-x86_64-apple-darwin', 'ffmpeg-universal-apple-darwin'];
    ffprobeTargets = ['ffprobe-aarch64-apple-darwin', 'ffprobe-x86_64-apple-darwin', 'ffprobe-universal-apple-darwin'];
    nodeTargets = ['node-aarch64-apple-darwin', 'node-x86_64-apple-darwin', 'node-universal-apple-darwin'];
    ytdlpTargets = ['yt-dlp-aarch64-apple-darwin', 'yt-dlp-x86_64-apple-darwin', 'yt-dlp-universal-apple-darwin'];
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
} else {
    ffmpegTargets = ['ffmpeg-x86_64-unknown-linux-gnu'];
    ffprobeTargets = ['ffprobe-x86_64-unknown-linux-gnu'];
    nodeTargets = ['node-x86_64-unknown-linux-gnu'];
    ytdlpTargets = ['yt-dlp-x86_64-unknown-linux-gnu'];
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
}

const binDir = path.join(__dirname, '..', 'src-tauri');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

// 1. Copy FFmpeg dari module ffmpeg-static
for (const target of ffmpegTargets) {
    const destFfmpeg = path.join(binDir, target);
    if (!fs.existsSync(destFfmpeg)) {
        fs.copyFileSync(ffmpegStatic, destFfmpeg);
        fs.chmodSync(destFfmpeg, 0o755);
        console.log(`[OK] Copied ffmpeg to ${destFfmpeg}`);
    } else {
        console.log(`[SKIP] ffmpeg already exists at ${destFfmpeg}`);
    }
}

// 1.5 Copy FFprobe dari module ffprobe-static
for (const target of ffprobeTargets) {
    const destFfprobe = path.join(binDir, target);
    if (!fs.existsSync(destFfprobe)) {
        fs.copyFileSync(ffprobeStatic.path, destFfprobe);
        fs.chmodSync(destFfprobe, 0o755);
        console.log(`[OK] Copied ffprobe to ${destFfprobe}`);
    } else {
        console.log(`[SKIP] ffprobe already exists at ${destFfprobe}`);
    }
}

// 1.7 Copy Node.js dari module node
const nodeSrc = path.join(__dirname, '..', 'node_modules', 'node', 'bin', platform === 'win32' ? 'node.exe' : 'node');
for (const target of nodeTargets) {
    const destNode = path.join(binDir, target);
    if (!fs.existsSync(destNode)) {
        if (fs.existsSync(nodeSrc)) {
            fs.copyFileSync(nodeSrc, destNode);
            fs.chmodSync(destNode, 0o755);
            console.log(`[OK] Copied node to ${destNode}`);
        } else {
            console.warn(`[WARN] Source node binary not found at ${nodeSrc}`);
        }
    } else {
        console.log(`[SKIP] node already exists at ${destNode}`);
    }
}

// 2. Download yt-dlp secara dinamis mengikuti redirect
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            console.log(`[SKIP] yt-dlp already exists at ${dest}`);
            return resolve();
        }
        
        console.log(`[INFO] Downloading yt-dlp from ${url}...`);
        
        const request = https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Ikuti redirect
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            } else if (response.statusCode !== 200) {
                reject(new Error(`Failed to download, status code: ${response.statusCode}`));
            } else {
                const file = fs.createWriteStream(dest);
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

// Unduh untuk masing-masing target macos
async function setupYtdlp() {
    for (const target of ytdlpTargets) {
        const destYtdlp = path.join(binDir, target);
        await downloadFile(ytdlpUrl, destYtdlp);
    }
}

setupYtdlp().catch(err => {
    console.error(`[ERROR] Failed to download yt-dlp:`, err);
    process.exit(1);
});
