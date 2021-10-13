import { bootBot } from '../main';

exports.command = 'bot';
exports.describe = 'Boot the discord bot';
exports.builder = {};
exports.handler = function (/* argv: Argv */) {
  bootBot();
};
