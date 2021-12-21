import logger from '@cardstack/logger';
import nodeCleanup from 'node-cleanup';
import { createContainer } from '../main';
import type { HubWorker } from '../worker';

export const command = 'worker';
export const describe = 'Boot the worker';
export const builder = {};

const log = logger('hub/worker');

export async function handler(/* argv: Argv */) {
  let container = createContainer();
  let worker: HubWorker;
  try {
    worker = await container.lookup('hubWorker');
  } catch (err: any) {
    log.error('Worker failed to start cleanly: %s', err.stack || err);
    // eslint-disable-next-line no-process-exit
    process.exit(-1);
  }

  nodeCleanup((_exitCode, signal) => {
    container.teardown().then(() => {
      process.kill(process.pid, signal as string);
    });
    nodeCleanup.uninstall(); // don't call cleanup handler again
    return false;
  });

  return worker.boot();
}
