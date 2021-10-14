import { Guild, GuildMember } from 'discord.js';
import config from 'config';
import { DiscordConfig } from '../types';

const { betaTesterRole: roleName } = config.get('discord') as DiscordConfig;

export function isBetaTester(guild: Guild, member: GuildMember): boolean {
  let betaTesterRole = guild?.roles.cache.find((role) => role.name === roleName);
  let isBetaTester = betaTesterRole?.id && member.roles.cache.has(betaTesterRole.id);
  return Boolean(isBetaTester);
}
