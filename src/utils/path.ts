export const basename = (p: string) => p.split(/[\\/]/).pop() || p;
export const dirname = (p: string) => p.substring(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))) || p;
export const joinPath = (...parts: string[]) => {
  const sep = parts[0]?.includes('\\') ? '\\' : '/';
  return parts
    .map((part, idx) => (idx === 0 ? part.replace(/[\\/]+$/, '') : part.replace(/^[\\/]+|[\\/]+$/g, '')))
    .filter(Boolean)
    .join(sep);
};
