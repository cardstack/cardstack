import { runInitializers, createRegistry } from '../main';
import HubBot from '../services/discord-bots/hub-bot';
import * as Sentry from '@sentry/node';
import { Registry, Container } from '@cardstack/di';

import logger from '@cardstack/logger';
export const log = logger('hub/bot');

export class HubBotController {
  static async create(serverConfig?: { registryCallback?: (r: Registry) => void }): Promise<HubBotController> {
    log.info(`booting pid:${process.pid}`);
    runInitializers();

    let registry = createRegistry();
    if (serverConfig?.registryCallback) {
      serverConfig.registryCallback(registry);
    }
    let container = new Container(registry);
    let bot: HubBot | undefined;

    try {
      bot = await container.instantiate(HubBot);
      await bot.start();
    } catch (e: any) {
      log.error(`Unexpected error ${e.message}`, e);
      Sentry.withScope(function () {
        Sentry.captureException(e);
      });
    }

    if (!bot) {
      throw new Error('Bot could not be created');
    }
    log.info(`started (${bot.type}:${bot.botInstanceId})`);

    return new this(bot, container);
  }

  private constructor(public bot: HubBot, public container: Container) {}

  async teardown() {
    log.info('shutting down');
    await this.bot.destroy();
    await this.container.teardown();
  }
}
