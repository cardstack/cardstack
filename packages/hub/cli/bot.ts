import { HubBotController } from '../main';

export const command = 'bot';
export const describe = 'Boot the discord bot';
export const builder = {};
export async function handler(/* argv: Argv */) {
  await HubBotController.create();
}
