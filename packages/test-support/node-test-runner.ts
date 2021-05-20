import glob from 'glob';
// @ts-ignore
import requireUncached from 'require-uncached';
import prepare from './prepare-node-tests';

export default function () {
  process.env.SERVER_SECRET = '2Lhrsi7xSDMv1agfW+hghvQkdkTRSqW/JGApSjLT0NA=';
  // generated with `crypto.randomBytes(32).toString('base64')`

  let patterns = ['packages/*/node-tests/**/*-test.js', 'node-tests/**/*-test.js'];

  for (let pattern of patterns) {
    for (let file of glob.sync(pattern)) {
      prepare();
      requireUncached(process.cwd() + '/' + file);
    }
  }
}
