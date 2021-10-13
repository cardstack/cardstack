import { Guild, GuildMember } from 'discord.js';
import config from './config.json';

export function isBetaTester(guild: Guild, member: GuildMember): boolean {
  let betaTesterRole = guild?.roles.cache.find((role) => role.name === config.recipientRoleName);
  let isBetaTester = betaTesterRole?.id && member.roles.cache.has(betaTesterRole.id);
  return Boolean(isBetaTester);
}
