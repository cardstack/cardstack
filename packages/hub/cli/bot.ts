import { HubBotController } from '../process-controllers/hub-bot-controller';

export const command = 'bot';
export const describe = 'Boot the discord bot';
export const builder = {};
export async function handler(/* argv: Argv */) {
  let botController = await HubBotController.create();
  process.on('SIGTERM', botController.bot.disconnect.bind(botController.bot));
}
