import type { Argv } from 'yargs';
if (process.env.COMPILER) {
  exports.command = 'compiler <command>';
  exports.desc = 'Commands related to the compiling of cards';

  exports.builder = function (yargs: Argv) {
    return yargs.commandDir('./compiler');
  };

  exports.handler = function (/* argv: Argv */) {};
}
