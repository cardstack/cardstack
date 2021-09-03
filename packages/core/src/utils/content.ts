import mime from 'mime-types';

const FALLBACK_TYPE = 'application/octet-stream';

export const JS_TYPE = 'text/javascript';
export const CSS_TYPE = 'text/css';

export function getFileType(filename: string): string {
  return mime.lookup(filename) || FALLBACK_TYPE;
}
