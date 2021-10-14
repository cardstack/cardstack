export function ensureTrailingSlash(p: string): string {
  return p.replace(/\/$/, '') + '/';
}
