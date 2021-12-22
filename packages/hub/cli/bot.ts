import logger from '@cardstack/logger';
import nodeCleanup from 'node-cleanup';
import { createContainer } from '../main';
import type HubBot from '../services/discord-bots/hub-bot';

const log = logger('hub/bot');

export const command = 'bot';
export const describe = 'Boot the discord bot';
export const builder = {};
export async function handler(/* argv: Argv */) {
  let container = createContainer();
  let bot: HubBot;
  try {
    bot = await container.lookup('hubBot');
  } catch (err: any) {
    log.error('HubBot failed to start cleanly: %s', err.stack || err);
    // eslint-disable-next-line no-process-exit
    process.exit(-1);
  }

  process.on('SIGTERM', bot.disconnect.bind(bot));

  nodeCleanup((_exitCode, signal) => {
    container.teardown().then(() => {
      process.kill(process.pid, signal as string);
    });
    nodeCleanup.uninstall(); // don't call cleanup handler again
    return false;
  });

  await bot.start();
}
