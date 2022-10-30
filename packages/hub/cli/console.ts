import config from 'dotenv';
import repl from 'repl';
import { createContainer } from '../main';
import { runInitializers } from '../main';

export const command = 'console';
export const describe = 'Load up a REPL! 📖 🤔 🖨 🔁';
export const builder = {};

export function handler(/* argv: Argv */) {
  // Catch errors so we don't trigger alerting via Sentry
  let container;
  try {
    config.config();
    container = createContainer();
    runInitializers();

    let replServer = repl.start({
      prompt: 'Hub > ',
    });
    replServer.context.container = container;
  } catch (e) {
    console.error('Failed to start console');
    console.error(e);
    container?.teardown();
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}
