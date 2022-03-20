import yargs from 'yargs';
import { commands } from './commands';

export function buildYargs(args: string[]) {
  return yargs(args)
    .scriptName('cardpay')
    .demandCommand(1, 'Please specify a command')
    .usage('Usage: $0 <command> [options]')
    .help()
    .command(commands)
    .options({
      mnemonic: {
        alias: 'm',
        default: process.env.MNEMONIC_PHRASE,
        type: 'string',
        description: 'Phrase for mnemonic wallet',
      },
    })
    .check((argv) => {
      if (process.env.BUILDING_README) {
        return true;
      }
      switch (argv.connectionType) {
        case 'mnemonic':
          if (!argv.mnemonic) {
            return `mnemonic not specified with connectionType ${argv.connectionType}`;
          } else {
            argv.web3Opts = {
              mnemonic: argv.mnemonic,
            };
            return true;
          }
        case 'wallet-connect':
          return true;
        case 'trezor':
          return true;
        default:
          return 'You need connectionType';
      }
    })
    .demandOption(['network'], `'network' must be specified.`);
}
