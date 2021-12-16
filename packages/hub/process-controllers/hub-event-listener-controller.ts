import { ContractSubscriptionEventHandler } from '../services/contract-subscription-event-handler';
import { runInitializers, createRegistry } from '../main';
import * as Sentry from '@sentry/node';
import { Registry, Container } from '@cardstack/di';
import { eventListenerLog } from '../utils/logger';

export class HubEventListenerController {
  logger = eventListenerLog;
  static logger = eventListenerLog;

  static async create(serverConfig?: {
    registryCallback?: (r: Registry) => void;
  }): Promise<HubEventListenerController> {
    this.logger.info(`booting pid:${process.pid}`);
    runInitializers();

    let registry = createRegistry();
    if (serverConfig?.registryCallback) {
      serverConfig.registryCallback(registry);
    }
    let container = new Container(registry);
    let handler: ContractSubscriptionEventHandler | undefined;

    let contracts = await container.lookup('contracts');
    let web3 = await container.lookup('web3-socket');
    let workerClient = await container.lookup('worker-client');
    let latestEventBlockQueries = await container.lookup('latest-event-block-queries');

    try {
      let handler = await container.instantiate(
        ContractSubscriptionEventHandler,
        web3,
        workerClient,
        contracts,
        latestEventBlockQueries
      );
      await handler.setupContractEventSubscriptions();
    } catch (e: any) {
      this.logger.error(`Unexpected error when running ContractSubscriptionEventHandler ${e.message}`, e);
      Sentry.withScope(function () {
        Sentry.captureException(e);
      });
    }

    return new this(handler!, container);
  }

  private constructor(public handler: ContractSubscriptionEventHandler, public container: Container) {}

  async teardown() {
    this.logger.info('shutting down');
    await this.container.teardown();
  }
}
