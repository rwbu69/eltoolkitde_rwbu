const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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
    if (!source || !fs.existsSync(source)) {
        throw new Error(`Source executable not found: ${source}`);
    }
    const destExists = fs.existsSync(destination) && fs.statSync(destination).size > 0;
    if (!destExists) {
        fs.copyFileSync(source, destination);
        try {
            fs.chmodSync(destination, 0o755);
        } catch {
            // ignore chmod on platforms where it's not supported
        }
        console.log(`[OK] Copied ${path.basename(destination)}`);
    } else {
        console.log(`[SKIP] ${path.basename(destination)} already exists`);
    }
}

const ffprobeMap = {
    'x86_64-pc-windows-msvc': path.join(__dirname, '..', 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
    'x86_64-unknown-linux-gnu': path.join(__dirname, '..', 'node_modules', 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe'),
    'x86_64-apple-darwin': path.join(__dirname, '..', 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'x64', 'ffprobe'),
    'aarch64-apple-darwin': path.join(__dirname, '..', 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe'),
};

const ffprobeSource = (ffprobeMap[target] && fs.existsSync(ffprobeMap[target]))
    ? ffprobeMap[target]
    : (ffprobeStatic && ffprobeStatic.path ? ffprobeStatic.path : null);

copyExecutable(ffmpegStatic, path.join(binDir, targetName('ffmpeg')));
copyExecutable(ffprobeSource, path.join(binDir, targetName('ffprobe')));

function downloadFile(url, destination) {
    if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
        const canValidate = target === getDefaultTarget();
        const validation = canValidate
            ? spawnSync(process.platform === 'win32' ? 'cmd.exe' : destination, process.platform === 'win32' ? ['/c', destination, '--version'] : ['--version'], {
                stdio: 'ignore',
                windowsHide: true,
            })
            : null;

        if (!canValidate || validation?.status === 0) {
            console.log(`[SKIP] ${path.basename(destination)} already exists`);
            return;
        }

        console.log(`[WARN] Existing ${path.basename(destination)} failed validation; replacing it`);
        fs.rmSync(destination, { force: true });
    }

    const temporaryDestination = `${destination}.download`;
    fs.rmSync(temporaryDestination, { force: true });
    console.log(`[INFO] Downloading yt-dlp for ${target}...`);

    const result = spawnSync(
        process.platform === 'win32' ? 'curl.exe' : 'curl',
        ['--fail', '--location', '--retry', '3', '--output', temporaryDestination, url],
        { stdio: 'inherit', windowsHide: true }
    );

    if (result.error) {
        fs.rmSync(temporaryDestination, { force: true });
        throw new Error(`Failed to start curl.exe: ${result.error.message}`);
    }
    if (result.status !== 0) {
        fs.rmSync(temporaryDestination, { force: true });
        throw new Error(`curl.exe failed with exit code ${result.status}`);
    }

    const downloadedSize = fs.statSync(temporaryDestination).size;
    if (downloadedSize < 1024 * 1024) {
        fs.rmSync(temporaryDestination, { force: true });
        throw new Error(`Downloaded yt-dlp is unexpectedly small (${downloadedSize} bytes)`);
    }

    fs.renameSync(temporaryDestination, destination);
    fs.chmodSync(destination, 0o755);
    console.log(`[OK] Downloaded ${path.basename(destination)} (${downloadedSize} bytes)`);
}

try {
    downloadFile(targetConfig.ytdlpUrl, path.join(binDir, targetName('yt-dlp')));
} catch (error) {
    console.error(`[ERROR] Failed to set up sidecars: ${error.message}`);
    process.exitCode = 1;
}
