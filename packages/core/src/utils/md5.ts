import { createHash } from 'crypto';

export default function md5(str: string): string {
  let hash = createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}
