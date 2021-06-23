import glob from 'glob';
// @ts-ignore
import requireUncached from 'require-uncached';
import prepare from './prepare-node-tests';
import path from 'path';

export default function (packageName?: string) {
  let pattern = path.join(__dirname, `../../packages`, packageName || '*', 'node-tests/**/*-test.js');
  for (let file of glob.sync(pattern)) {
    prepare();
    requireUncached(file);
  }
}
