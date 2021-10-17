import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { Event } from '../bot';

const log = logger('events:ready');

export const name: Event['name'] = 'ready';
export const run: Event['run'] = async (client) => {
  if (!client.user) {
    log.error('Bot user not found');
    Sentry.withScope(function () {
      Sentry.captureMessage('Bot user not found');
    });
    return;
  }
  log.info(`Logged in as ${client.user.tag}`);
  Sentry.addBreadcrumb({ message: `logged in bot ${client.user.tag}` });
};
