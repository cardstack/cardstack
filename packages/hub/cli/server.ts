import dotenv from 'dotenv';
import { bootServer } from '../main';

exports.command = 'serve';
exports.aliases = 'server';
exports.describe = 'Boot the server';
exports.builder = {};
exports.handler = function (/* argv: Argv */) {
  dotenv.config();
  bootServer();
};
