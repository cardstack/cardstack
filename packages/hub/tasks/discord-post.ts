import config from 'config';
import fetch from 'node-fetch';
import { Helpers } from 'graphile-worker';

export default class DiscordPost {
  async perform(payload: any, _helpers: Helpers) {
    let { channel, message } = payload;
    if (channel === 'on-call-internal') {
      let discordWebhook = config.get('discord.onCallInternalWebhook') as string;
      await fetch(discordWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
        }),
      });
    } else {
      throw new Error(`Unsupported channel ${channel}`);
    }
  }
}
