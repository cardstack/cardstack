/* eslint no-process-exit: "off" */
import yargs from 'yargs';
import fetch from 'node-fetch';
import { hideBin } from 'yargs/helpers';
import { commands } from './commands';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

(async () => {
  await yargs(hideBin(process.argv))
    .scriptName('cardpay')
    .demandCommand(1, 'Please specify a command')
    .usage('Usage: $0 <command> [options]')
    .help()
    .command(commands)
    .options({
      network: {
        alias: 'n',
        type: 'string',
        description: "The Layer 1 network to run this script in ('kovan' or 'mainnet')",
      },
      mnemonic: {
        alias: 'm',
        type: 'string',
        description: 'Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE',
      },
      walletConnect: {
        alias: 'w',
        type: 'boolean',
        description: 'A flag to indicate that wallet connect should be used for the wallet',
      },
    })
    .check((argv) => {
      if (!argv.mnemonic && !argv.walletConnect) {
        return 'Wallet is not specified. Either specify that wallet connect should be used for the wallet, or specify the mnemonic as a positional arg, or pass the mnemonic in using the MNEMONIC_PHRASE env var';
      }
      // is this the right way to do this?
      if (argv.walletConnect) {
        argv.mnemonic = undefined;
      }
      return true;
    })
    .demandOption(['network'], `'network' must be specified.`)
    .parse();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
