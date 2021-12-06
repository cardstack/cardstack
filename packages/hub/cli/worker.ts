import { bootWorker } from '../main';

export const command = 'worker';
export const describe = 'Boot the worker';
export const builder = {};
export function handler(/* argv: Argv */) {
  bootWorker();
}
