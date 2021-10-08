import logger from '@cardstack/logger';
import { Event } from '../bot';

const log = logger('events:ready');

export const name: Event['name'] = 'ready';
export const run: Event['run'] = async (client) => {
  if (!client.user) {
    log.error('Bot user not found');
    return;
  }
  log.info(`Logged in as ${client.user.tag}`);
};
