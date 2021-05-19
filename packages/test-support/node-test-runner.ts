import glob from 'glob';
// @ts-ignore
import requireUncached from 'require-uncached';
import prepare from './prepare-node-tests';

export default function () {
  process.env.SERVER_SECRET = 'test123abc';

  let patterns = ['packages/*/node-tests/**/*-test.js', 'node-tests/**/*-test.js'];

  for (let pattern of patterns) {
    for (let file of glob.sync(pattern)) {
      prepare();
      requireUncached(process.cwd() + '/' + file);
    }
  }
}
