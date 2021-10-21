import { HubBot } from '../main';

exports.command = 'bot';
exports.describe = 'Boot the discord bot';
exports.builder = {};
exports.handler = async function (/* argv: Argv */) {
  await HubBot.create();
};
