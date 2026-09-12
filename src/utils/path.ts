export const basename = (p: string) => p.split(/[\\/]/).pop() || p;
export const dirname = (p: string) => p.substring(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))) || p;
export const joinPath = (...parts: string[]) => parts.join('\\').replace(/\\\\/g, '\\');
