import config from 'dotenv';
import repl from 'repl';
import { createContainer } from '../main';
import { runInitializers } from '../main';

export const command = 'console';
export const describe = 'Load up a REPL! 📖 🤔 🖨 🔁';
export const builder = {};

export function handler(/* argv: Argv */) {
  config.config();
  let container = createContainer();
  runInitializers();

  let replServer = repl.start({
    prompt: 'Hub > ',
  });
  replServer.context.container = container;
}
