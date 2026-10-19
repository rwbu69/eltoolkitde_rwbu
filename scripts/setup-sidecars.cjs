const fs = require('fs');
const path = require('path');
const https = require('https');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

const platform = process.platform;
const target = process.env.TARGET_TRIPLE
    || process.env.TAURI_ENV_TARGET_TRIPLE
    || getDefaultTarget();

const targets = {
    'x86_64-pc-windows-msvc': {
        suffix: '.exe',
        ytdlpUrl: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        nodeBinary: 'node.exe',
    },
    'x86_64-unknown-linux-gnu': {
        suffix: '',
        ytdlpUrl: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
        nodeBinary: 'node',
    },
    'x86_64-apple-darwin': {
        suffix: '',
        ytdlpUrl: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
        nodeBinary: 'node',
    },
    'aarch64-apple-darwin': {
        suffix: '',
        ytdlpUrl: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
        nodeBinary: 'node',
    },
};

if (!targets[target]) {
    throw new Error(`Unsupported sidecar target: ${target}`);
}

const targetConfig = targets[target];
const binDir = path.join(__dirname, '..', 'src-tauri');
fs.mkdirSync(binDir, { recursive: true });

function getDefaultTarget() {
    if (platform === 'win32') return 'x86_64-pc-windows-msvc';
    if (platform === 'darwin') {
        return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
    }
    return 'x86_64-unknown-linux-gnu';
}

function targetName(name) {
    return `${name}-${target}${targetConfig.suffix}`;
}

function copyExecutable(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.copyFileSync(source, destination);
        fs.chmodSync(destination, 0o755);
        console.log(`[OK] Copied ${path.basename(destination)}`);
    } else {
        console.log(`[SKIP] ${path.basename(destination)} already exists`);
    }
}

copyExecutable(ffmpegStatic, path.join(binDir, targetName('ffmpeg')));
copyExecutable(ffprobeStatic.path, path.join(binDir, targetName('ffprobe')));

const nodeSource = path.join(__dirname, '..', 'node_modules', 'node', 'bin', targetConfig.nodeBinary);
if (!fs.existsSync(nodeSource)) {
    throw new Error(`Node sidecar binary was not found at ${nodeSource}`);
}
copyExecutable(nodeSource, path.join(binDir, targetName('node')));

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
            console.log(`[SKIP] ${path.basename(destination)} already exists`);
            resolve();
            return;
        }

        console.log(`[INFO] Downloading yt-dlp for ${target}...`);
        const request = https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
                response.resume();
                downloadFile(response.headers.location, destination).then(resolve, reject);
                return;
            }

            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`Failed to download yt-dlp: HTTP ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(destination);
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    fs.chmodSync(destination, 0o755);
                    console.log(`[OK] Downloaded ${path.basename(destination)}`);
                    resolve();
                });
            });
            file.on('error', (error) => {
                file.close();
                fs.rm(destination, { force: true }, () => reject(error));
            });
        });

        request.on('error', (error) => {
            fs.rm(destination, { force: true }, () => reject(error));
        });
    });
}

downloadFile(targetConfig.ytdlpUrl, path.join(binDir, targetName('yt-dlp')))
    .catch((error) => {
        console.error(`[ERROR] Failed to set up sidecars: ${error.message}`);
        process.exitCode = 1;
    });
