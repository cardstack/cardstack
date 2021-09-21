import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import dotenv from 'dotenv';
dotenv.config();

yargs(hideBin(process.argv))
  .scriptName('hub')
  .commandDir('../cli', { extensions: ['js'] })
  .demandCommand()
  .help().argv;
