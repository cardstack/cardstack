import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { printCompilerError } from '@cardstack/core/src/utils/errors';
import dotenv from 'dotenv';
import { commands } from './cli/index';
import * as Sentry from '@sentry/node';
import config from 'config';
import initSentry from './initializers/sentry';

dotenv.config();

let sentryEnabled: boolean = config.get('sentry.enabled');
if (sentryEnabled) {
  initSentry();
  console.log('SENTRY ENABLED');
}

yargs(hideBin(process.argv))
  .scriptName('hub')
  .command(commands)
  .demandCommand()
  .help()
  .fail((msg, err, yargs) => {
    if (msg) {
      console.log(msg + '\n');
      console.log(yargs.help());
    }
    if (err) {
      console.log('\n💡 While running:');
      console.log(yargs.help());

      console.error('\n🚨 Hub command failed with error:\n');
      console.error(printCompilerError(err));

      Sentry.captureException(err, { tags: { alert: 'web-team' } });
      // Make sure that we send all exceptions before exiting
      Sentry.getCurrentHub()!
        .getClient()!
        .close(5000)
        .then((result) => {
          if (!result) {
            console.error('Failed to send error to Sentry because we hit the timeout.');
          }

          // eslint-disable-next-line no-process-exit
          process.exit(1);
        });
    } else {
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }).argv;
