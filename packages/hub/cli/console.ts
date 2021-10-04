import config from 'dotenv';
import repl from 'repl';
import { bootEnvironment } from '../main';

exports.command = 'console';
exports.describe = 'Load up a REPL! 📖 🤔 🖨 🔁';
exports.builder = {};

exports.handler = function (/* argv: Argv */) {
  config.config();
  let container = bootEnvironment();
  let replServer = repl.start({
    prompt: 'Hub > ',
  });
  replServer.context.container = container;
};
