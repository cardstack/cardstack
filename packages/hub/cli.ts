import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { printCompilerError } from '@cardstack/core/src/utils/errors';
import dotenv from 'dotenv';
import { commands } from './cli/index';

dotenv.config();

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
      console.error('\n🚨 Hub command failed with error:\n');
      console.error(printCompilerError(err));
    }
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }).argv;
