import { clearConsole, selectFolder, selectFile } from './utils.js';
import { generateQueue, startQueue } from './ytdlp.js';
import { processMirror, processTrim, processMp3Convert } from './ffmpeg.js';
import { toggleMetaTarget, processMetadata } from './metadata.js';

// Setup Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// Expose some utils to window for inline onclicks if needed (or bind them directly)
// We will bind them directly instead of using inline onclicks for a cleaner structure

// Setup global buttons
document.querySelector('.console-header .btn-clear').addEventListener('click', clearConsole);

// Module 1: YT-DLP
document.getElementById('btn-generate-queue').addEventListener('click', generateQueue);
document.getElementById('btn-start-queue').addEventListener('click', startQueue);
document.getElementById('yt-cookie-mode').addEventListener('change', () => {
    const mode = document.getElementById('yt-cookie-mode').value;
    document.getElementById('cookie-browser-group').style.display = mode === 'browser' ? 'block' : 'none';
    document.getElementById('cookie-file-group').style.display = mode === 'file' ? 'block' : 'none';
});
document.getElementById('btn-yt-cookie-file').addEventListener('click', () => selectFile('yt-cookie-file'));
document.getElementById('btn-yt-output').addEventListener('click', () => selectFolder('yt-output'));

// Module 2: FFmpeg Tools
document.getElementById('btn-mirror-input').addEventListener('click', () => selectFile('mirror-input'));
document.getElementById('btn-mirror-output').addEventListener('click', () => selectFolder('mirror-output'));
document.getElementById('form-mirror').addEventListener('submit', async (e) => {
    e.preventDefault();
    await processMirror();
});

document.getElementById('btn-trim-input').addEventListener('click', () => selectFile('trim-input'));
document.getElementById('btn-trim-output').addEventListener('click', () => selectFolder('trim-output'));
document.getElementById('form-trim').addEventListener('submit', async (e) => {
    e.preventDefault();
    await processTrim();
});

// Module 3: MP3 Converter
document.getElementById('btn-mp3-input').addEventListener('click', () => selectFolder('mp3-input'));
document.getElementById('btn-mp3-output').addEventListener('click', () => selectFolder('mp3-output'));
document.getElementById('form-mp3').addEventListener('submit', async (e) => {
    e.preventDefault();
    await processMp3Convert();
});

// Module 4: Metadata Editor
document.getElementById('meta-mode').addEventListener('change', toggleMetaTarget);
// The btn click is dynamically handled in metadata.js, but we set the default here
document.getElementById('meta-btn').addEventListener('click', () => selectFile('meta-input'));

document.getElementById('form-metadata').addEventListener('submit', async (e) => {
    e.preventDefault();
    await processMetadata();
});
