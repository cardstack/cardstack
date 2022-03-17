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
        description: 'Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE',
      },
      walletConnect: {
        alias: 'w',
        type: 'boolean',
        description: 'A flag to indicate that wallet connect should be used for the wallet',
      },
      trezor: {
        alias: 't',
        type: 'boolean',
        description: 'A flag to indicate that trezor should be used for the wallet',
      },
    })
    .check((argv) => {
      if (process.env.BUILDING_README) {
        return true;
      }

      if (!argv.trezor && !argv.mnemonic && !argv.walletConnect) {
        return 'Wallet is not specified. Either specify that wallet connect should be used for the wallet, or specify the mnemonic as a positional arg, or pass the mnemonic in using the MNEMONIC_PHRASE env var';
      }

      if (argv.trezor) {
        argv.mnemonic = undefined;
        argv.walletConnect = undefined;
      }
      if (argv.walletConnect && !argv.trezor) {
        argv.mnemonic = undefined;
        argv.trezor = undefined;
      }
      return true;
    })
    .demandOption(['network'], `'network' must be specified.`);
}
