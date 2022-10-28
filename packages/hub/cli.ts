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
  .fail(async (msg, err, yargs) => {
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
      let sentryClient = Sentry.getCurrentHub()?.getClient();

      if (sentryClient) {
        // Make sure that we send all exceptions before exiting
        let result = await sentryClient.close(5000);
        if (!result) {
          console.error('Failed to send error to Sentry because we hit the timeout.');
        }
      } else {
        console.error('Sentry not enabled, will not report Hub command exceptions');
      }
    }

    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }).argv;
