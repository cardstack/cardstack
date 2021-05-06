/* eslint no-process-exit: "off" */
import yargs from 'yargs';
import fetch from 'node-fetch';
import bridge from './bridge.js';
import awaitBridged from './await-bridged.js';
import viewSafes from './view-safes.js';
import createPrepaidCard from './create-prepaid-card.js';
import { usdPrice, ethPrice, oracleUpdatedAt } from './exchange-rate';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

type Commands =
  | 'bridge'
  | 'awaitBridged'
  | 'safesView'
  | 'prepaidCardCreate'
  | 'usdPrice'
  | 'ethPrice'
  | 'oracleUpdatedAt';

let command: Commands | undefined;
interface Options {
  network: string;
  mnemonic: string;
  tokenAddress?: string;
  amount?: number;
  fromBlock?: number;
  address?: string;
  token?: string;
  safeAddress?: string;
  receiver?: string;
  recipient?: string;
  amounts?: number[];
}
const {
  network,
  mnemonic = process.env.MNEMONIC_PHRASE,
  tokenAddress,
  amount,
  address,
  token,
  safeAddress,
  fromBlock,
  receiver,
  recipient,
  amounts,
} = yargs(process.argv.slice(2))
  .scriptName('cardpay')
  .usage('Usage: $0 <command> [options]')
  .command('bridge <amount> [tokenAddress] [receiver]', 'Bridge tokens to the layer 2 network', (yargs) => {
    yargs.positional('amount', {
      type: 'number',
      description: 'Amount of tokens you would like bridged (*not* in units of wei)',
    });
    yargs.positional('tokenAddress', {
      type: 'string',
      default: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // Kovan DAI
      description: 'The token address (defaults to Kovan DAI)',
    });
    yargs.positional('receiver', {
      description: 'Layer 2 address to be owner of L2 safe, defaults to same as L1 address',
      type: 'string',
    });
    command = 'bridge';
  })
  .command('await-bridged <fromBlock> [recipient]', 'Wait for token bridging to complete on L2', (yargs) => {
    yargs.positional('fromBlock', {
      type: 'number',
      description: 'Layer 2 block height before bridging was initiated',
    });
    yargs.positional('recipient', {
      type: 'string',
      description: 'Layer 2 address that is the owner of the bridged tokens, defaults to wallet address',
    });
    command = 'awaitBridged';
  })
  .command(
    'safes-view [address]',
    'View contents of the safes owned by the specified address (or default wallet account)',
    (yargs) => {
      yargs.positional('address', {
        type: 'string',
        description: "The address of the safe owner. This defaults to your wallet's default account when not provided",
      });
      command = 'safesView';
    }
  )
  .command(
    'prepaidcard-create <safeAddress> <tokenAddress> <amounts..>',
    'Create prepaid cards using the specified token from the specified safe with the amounts provided',
    (yargs) => {
      yargs.positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose funds to use to create the prepaid cards',
      });
      yargs.positional('tokenAddress', {
        type: 'string',
        default: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // Kovan DAI
        description: 'The token address (defaults to Kovan DAI)',
      });
      yargs.positional('amounts', {
        type: 'string',
        description: 'The amount of tokens used to create each prepaid card (*not* in units of wei)',
      });
      command = 'prepaidCardCreate';
    }
  )
  .command(
    'usd-price <token> <amount>',
    'Get the USD value for the USD value for the specified token in the specified amount',
    (yargs) => {
      yargs.positional('token', {
        type: 'string',
        description: 'The token symbol (without the .CPXD suffix)',
      });
      yargs.positional('amount', {
        type: 'string',
        description: 'The amount of the specified token (*not* in units of wei)',
      });
      command = 'usdPrice';
    }
  )
  .command(
    'eth-price <token> <amount>',
    'Get the ETH value for the USD value for the specified token in the specified amount',
    (yargs) => {
      yargs.positional('token', {
        type: 'string',
        description: 'The token symbol (without the .CPXD suffix)',
      });
      yargs.positional('amount', {
        type: 'string',
        description: 'The amount of the specified token (*not* in units of wei)',
      });
      command = 'ethPrice';
    }
  )
  .command(
    'oracle-updated-at <token>',
    'Get the date that the oracle was last updated for the specified token',
    (yargs) => {
      yargs.positional('token', {
        type: 'string',
        description: 'The token symbol (without the .CPXD suffix)',
      });
      command = 'oracleUpdatedAt';
    }
  )
  .options({
    network: {
      alias: 'n',
      type: 'string',
      description: "The Layer 1 network to ruin this script in ('kovan' or 'mainnet')",
    },
    mnemonic: {
      alias: 'm',
      type: 'string',
      description: 'Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE',
    },
  })
  .demandOption(['network'], `'network' must be specified.`)
  .demandCommand(1, 'Please specify a command')
  .help().argv as Options;

if (!mnemonic) {
  yargs.showHelp(
    'No mnemonic is defined, either specify the mnemonic as a positional arg or pass it in using the MNEMONIC_PHRASE env var'
  );
  process.exit(1);
}

if (!command) {
  throw new Error('missing command--should never get here');
}

(async () => {
  switch (command) {
    case 'bridge':
      if (amount == null) {
        yargs.showHelp('amount is a required value');
        process.exit(1);
      }
      await bridge(network, mnemonic, amount, receiver, tokenAddress);
      break;
    case 'awaitBridged':
      if (fromBlock == null) {
        yargs.showHelp('fromBlock is a required value');
        process.exit(1);
      }
      await awaitBridged(network, mnemonic, fromBlock, recipient);
      break;
    case 'safesView':
      await viewSafes(network, mnemonic, address);
      break;
    case 'prepaidCardCreate':
      if (safeAddress == null || amounts == null) {
        yargs.showHelp('safeAddress and amounts are required values');
        process.exit(1);
      }
      await createPrepaidCard(network, mnemonic, safeAddress, amounts, tokenAddress);
      break;
    case 'usdPrice':
      if (token == null || amount == null) {
        yargs.showHelp('token and amount are required values');
        process.exit(1);
      }
      await usdPrice(network, mnemonic, token, amount);
      break;
    case 'ethPrice':
      if (token == null || amount == null) {
        yargs.showHelp('token and amount are required values');
        process.exit(1);
      }
      await ethPrice(network, mnemonic, token, amount);
      break;
    case 'oracleUpdatedAt':
      if (token == null) {
        yargs.showHelp('token is a required value');
        process.exit(1);
      }
      await oracleUpdatedAt(network, mnemonic, token);
      break;
    default:
      assertNever(command);
  }
  process.exit(0);
})().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(1);
});

function assertNever(_value: never): never {
  throw new Error(`not never`);
}
