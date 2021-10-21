import { Guild, GuildMember } from '@cardstack/discord-bot';
import config from 'config';
import DiscordBot from '@cardstack/discord-bot';
import HubBot from '..';

export function assertHubBot(bot: DiscordBot): asserts bot is HubBot {
  if (bot.type !== 'hub-bot') {
    throw new Error('Expected a HubBot instance');
  }
}

const roleName = config.get('betaTesting.discordRole') as string;

export function isBetaTester(guild: Guild, member: GuildMember): boolean {
  let betaTesterRole = guild?.roles.cache.find((role) => role.name === roleName);
  let isBetaTester = betaTesterRole?.id && member.roles.cache.has(betaTesterRole.id);
  return Boolean(isBetaTester);
}
