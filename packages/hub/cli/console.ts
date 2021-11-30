import config from 'dotenv';
import repl from 'repl';
import { createContainer } from '../main';

export const command = 'console';
export const describe = 'Load up a REPL! 📖 🤔 🖨 🔁';
export const builder = {};

export function handler(/* argv: Argv */) {
  config.config();
  let container = createContainer();
  let replServer = repl.start({
    prompt: 'Hub > ',
  });
  replServer.context.container = container;
}
