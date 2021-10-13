import { Command } from '../bot';
import logger from '@cardstack/logger';

const log = logger('commands:handle-dm');

export const name: Command['name'] = 'handle-dm';
export const description: Command['description'] = 'Hand cardpay bot DMs';
export const run: Command['run'] = async (_client, message, [channelId] = []) => {
  if (!channelId || !message) {
    return;
  }
  // look up this user's GuildMember and assert they are a beta tester
};
