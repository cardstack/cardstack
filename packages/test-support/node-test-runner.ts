import glob from 'glob';
// @ts-ignore
import requireUncached from 'require-uncached';
import prepare from './prepare-node-tests';
import path from 'path';

export default function (packageName?: string) {
  process.env.SERVER_SECRET = '2Lhrsi7xSDMv1agfW+hghvQkdkTRSqW/JGApSjLT0NA=';
  // generated with `crypto.randomBytes(32).toString('base64')`

  let pattern = path.join(__dirname, `../../packages`, packageName || '*', 'node-tests/**/*-test.js');
  for (let file of glob.sync(pattern)) {
    prepare();
    requireUncached(file);
  }
}
