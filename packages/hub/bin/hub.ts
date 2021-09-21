import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .scriptName('hub')
  .commandDir('../cli', { extensions: ['js'] })
  .demandCommand()
  .help().argv;
