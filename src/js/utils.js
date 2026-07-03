const { open } = window.__TAURI__.dialog;

export async function joinPath(...parts) {
    return parts.join('\\').replace(/\\\\/g, '\\');
}

export function basename(p) {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1];
}

export function extname(p) {
    const match = p.match(/\.[^.]+$/);
    return match ? match[0] : '';
}

export function dirname(p) {
    const parts = p.split(/[\\/]/);
    parts.pop();
    return parts.join('\\');
}

const consoleEl = document.getElementById('console');
let lastProgressSpan = null;

export function appendLog(text) {
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

export function clearConsole() {
    consoleEl.innerHTML = '';
}

export async function selectFolder(inputId) {
    try {
        const path = await open({ directory: true, multiple: false });
        if (path) document.getElementById(inputId).value = path;
    } catch (e) {
        alert("Gagal membuka dialog folder");
    }
}

export async function selectFile(inputId) {
    try {
        const path = await open({ directory: false, multiple: false });
        if (path) document.getElementById(inputId).value = path;
    } catch (e) {
        alert("Gagal membuka dialog file");
    }
}
