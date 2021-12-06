import { createContainer, initSentry } from '../main';
import { contractSubscriptionEventHandlerLog } from '../utils/logger';
import { ContractSubscriptionEventHandler } from '../contract-subscription-event-handler';

export let command = 'contract-subscription-event-handler';
export let describe = 'Boot the contract subscription event handler';
export let builder = {};
export async function handler(/* argv: Argv */) {
  initSentry();

  let container = createContainer();
  try {
    let web3 = await container.lookup('web3-socket');
    let workerClient = await container.lookup('worker-client');
    let handler = new ContractSubscriptionEventHandler(web3, workerClient);
    await handler.setupContractEventSubscriptions();
  } catch (err: any) {
    contractSubscriptionEventHandlerLog.error(
      'Contract subscription event handler failed to start cleanly: %s',
      err.stack || err
    );
    // eslint-disable-next-line no-process-exit
    process.exit(-1);
  }
}
