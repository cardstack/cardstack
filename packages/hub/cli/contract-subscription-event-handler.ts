import { createContainer, initSentry } from '../main';
import { contractSubscriptionEventHandlerLog } from '../utils/logger';
import { ContractSubscriptionEventHandler } from '../contract-subsciption-event-handler';

export let command = 'contract-subscription-event-handler';
export let describe = 'Boot the contract subscription event handler';
export let builder = {};
export async function handler(/* argv: Argv */) {
  initSentry();

  let container = createContainer();
  try {
    (await container.lookup('contract-subscription-event-handler')) as ContractSubscriptionEventHandler;
  } catch (err: any) {
    contractSubscriptionEventHandlerLog.error(
      'Contract subscription event handler failed to start cleanly: %s',
      err.stack || err
    );
    // eslint-disable-next-line no-process-exit
    process.exit(-1);
  }
}
