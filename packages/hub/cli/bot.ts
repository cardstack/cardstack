import { HubBotController } from '../main';

exports.command = 'bot';
exports.describe = 'Boot the discord bot';
exports.builder = {};
exports.handler = async function (/* argv: Argv */) {
  let botController = await HubBotController.create();
  process.on('SIGTERM', botController.bot.disconnect.bind(botController.bot));
};
