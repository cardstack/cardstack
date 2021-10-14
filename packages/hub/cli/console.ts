import config from 'dotenv';
import repl from 'repl';
import { createContainer } from '../main';

exports.command = 'console';
exports.describe = 'Load up a REPL! 📖 🤔 🖨 🔁';
exports.builder = {};

exports.handler = function (/* argv: Argv */) {
  config.config();
  let container = createContainer();
  let replServer = repl.start({
    prompt: 'Hub > ',
  });
  replServer.context.container = container;
};
