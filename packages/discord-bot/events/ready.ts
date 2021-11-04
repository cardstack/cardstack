import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { Event } from '../bot';

const log = logger('events:ready');

export const name: Event['name'] = 'ready';
export const run: Event['run'] = async (client) => {
  const { allowedGuilds: guildsRaw, allowedChannels: channelsRaw } = client.config;
  let allowedGuilds = guildsRaw.split(',');
  let allowedChannels = channelsRaw.split(',');

  if (!client.user) {
    log.error('Bot user not found');
    Sentry.withScope(function () {
      Sentry.captureMessage('Bot user not found');
    });
    return;
  }
  let message = `logged in bot ${client.user.tag} in environment ${
    process.env.NODE_CONFIG_ENV || process.env.NODE_ENV || 'development'
  }. Monitoring guilds ${allowedGuilds.join(', ')} in channels ${allowedChannels.join(', ')}`;
  log.info(message);
  Sentry.addBreadcrumb({ message });
};
