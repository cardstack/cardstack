const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { printCompilerError } = require('@cardstack/core/src/utils/errors');
const { commands } = require('../cli');
require('dotenv').config();

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
