import { runInitializers, createRegistry } from '../main';
import HubBot from '../services/discord-bots/hub-bot';
import * as Sentry from '@sentry/node';
import { Registry, Container } from '@cardstack/di';
import { botLog } from '../utils/logger';

export class HubBotController {
  logger = botLog;
  static logger = botLog;

  static async create(serverConfig?: { registryCallback?: (r: Registry) => void }): Promise<HubBotController> {
    this.logger.info(`booting pid:${process.pid}`);
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
      this.logger.error(`Unexpected error ${e.message}`, e);
      Sentry.withScope(function () {
        Sentry.captureException(e);
      });
    }

    if (!bot) {
      throw new Error('Bot could not be created');
    }
    this.logger.info(`started (${bot.type}:${bot.botInstanceId})`);

    return new this(bot, container);
  }

  private constructor(public bot: HubBot, public container: Container) {}

  async teardown() {
    this.logger.info('shutting down');
    await this.bot.destroy();
    await this.container.teardown();
  }
}
