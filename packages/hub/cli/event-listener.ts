import { createContainer, runInitializers } from '../main';

import logger from '@cardstack/logger';
const log = logger('hub/event-listener');

export const command = 'event-listener';
export const describe = 'Boot the contract events listener (used for push notifications)';
export const builder = {};

export async function handler() {
  let container = createContainer();
  runInitializers();

  try {
    let eventListener = await container.lookup('contract-subscription-event-handler');
    eventListener.setupContractEventSubscriptions();
  } catch (e: any) {
    log.error(`Unexpected error while running contracts event listener: ${e.message}`, e);
    throw e;
  }
}
