/* eslint no-process-exit: "off" */
import fetch from 'node-fetch';
import { buildYargs } from './builder';
import { hideBin } from 'yargs/helpers';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

(async () => {
  await buildYargs(hideBin(process.argv)).parse();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
