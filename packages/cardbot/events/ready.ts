import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import config from 'config';
import { Event } from '../bot';
import { DiscordConfig } from '../types';

const log = logger('events:ready');
const { allowedGuilds: guildsRaw, allowedChannels: channelsRaw } = config.get('discord') as DiscordConfig;
let allowedGuilds = guildsRaw.split(',');
let allowedChannels = channelsRaw.split(',');

export const name: Event['name'] = 'ready';
export const run: Event['run'] = async (client) => {
  if (!client.user) {
    log.error('Bot user not found');
    Sentry.withScope(function () {
      Sentry.captureMessage('Bot user not found');
    });
    return;
  }
  let message = `logged in bot ${client.user.tag} in environment ${
    process.env.NODE_CONFIG_ENV
  }. Responding to guilds ${allowedGuilds.join(', ')} in channels ${allowedChannels.join(', ')}`;
  log.info(message);
  Sentry.addBreadcrumb({ message });
};
