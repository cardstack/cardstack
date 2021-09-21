import type { Argv } from 'yargs';
exports.command = 'db <command>';
exports.desc = 'Commands to manage the local database';

exports.builder = function (yargs: Argv) {
  return yargs.commandDir('./db');
};

exports.handler = function (/* argv: Argv */) {};
