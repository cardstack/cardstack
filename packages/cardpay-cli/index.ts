/* eslint no-process-exit: "off" */
import yargs from 'yargs';
import fetch from 'node-fetch';
import { bridgeToLayer1, bridgeToLayer2 } from './bridge.js';
import awaitBridged from './await-bridged.js';
import { viewTokenBalance } from './assets';
import { viewSafes, transferTokens, setSupplierInfoDID, viewSafe } from './safe.js';
import {
  create as createPrepaidCard,
  split as splitPrepaidCard,
  transfer as transferPrepaidCard,
  priceForFaceValue,
  payMerchant,
  gasFee,
} from './prepaid-card.js';
import { usdPrice, ethPrice, priceOracleUpdatedAt } from './exchange-rate';
import { claimRevenue, registerMerchant, revenueBalances } from './revenue-pool.js';
import { rewardTokenBalances } from './reward-pool.js';
import { hubAuth } from './hub-auth';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

type Commands =
  | 'bridgeToL2'
  | 'bridgeToL1'
  | 'awaitBridgedToL2'
  | 'safesView'
  | 'safeView'
  | 'safeTransferTokens'
  | 'prepaidCardCreate'
  | 'prepaidCardSplit'
  | 'prepaidCardTransfer'
  | 'usdPrice'
  | 'ethPrice'
  | 'priceOracleUpdatedAt'
  | 'gasFee'
  | 'priceForFaceValue'
  | 'payMerchant'
  | 'setSupplierInfoDID'
  | 'registerMerchant'
  | 'revenueBalances'
  | 'claimRevenue'
  | 'priceOracleUpdatedAt'
  | 'viewTokenBalance'
  | 'hubAuth'
  | 'rewardTokenBalances';

let command: Commands | undefined;
interface Options {
  network: string;
  mnemonic: string;
  walletConnect: boolean;
  tokenAddress?: string;
  amount?: number;
  fromBlock?: number;
  address?: string;
  token?: string;
  safeAddress?: string;
  newOwner?: string;
  spendFaceValue?: number;
  merchantSafe?: string;
  infoDID?: string;
  customizationDID?: string;
  prepaidCard?: string;
  receiver?: string;
  recipient?: string;
  hubRootUrl?: string;
  faceValues?: number[];
}
let {
  network,
  mnemonic = process.env.MNEMONIC_PHRASE,
  walletConnect,
  tokenAddress,
  amount,
  address,
  token,
  newOwner,
  safeAddress,
  spendFaceValue,
  merchantSafe,
  infoDID,
  customizationDID,
  prepaidCard,
  fromBlock,
  receiver,
  recipient,
  faceValues,
  hubRootUrl,
} = yargs(process.argv.slice(2))
  .scriptName('cardpay')
  .usage('Usage: $0 <command> [options]')
  .command('bridge-to-l2 <amount> <tokenAddress> [receiver]', 'Bridge tokens to the layer 2 network', (yargs) => {
    yargs.positional('amount', {
      type: 'number',
      description: 'Amount of tokens you would like bridged (*not* in units of wei)',
    });
    yargs.positional('tokenAddress', {
      type: 'string',
      description: 'The layer 1 token address',
    });
    yargs.positional('receiver', {
      description: 'Layer 2 address to be the owner of L2 safe, defaults to same as L1 address',
      type: 'string',
    });
    command = 'bridgeToL2';
  })
  .command('await-bridged-to-l2 <fromBlock> [recipient]', 'Wait for token bridging to complete on L2', (yargs) => {
    yargs.positional('fromBlock', {
      type: 'number',
      description: 'Layer 2 block height before bridging was initiated',
    });
    yargs.positional('recipient', {
      type: 'string',
      description: 'Layer 2 address that is the owner of the bridged tokens, defaults to wallet address',
    });
    command = 'awaitBridgedToL2';
  })
  .command(
    'bridge-to-l1 <safeAddress> <amount> <tokenAddress> <receiver>',
    'Bridge tokens to the layer 1 network',
    (yargs) => {
      yargs.positional('safeAddress', {
        type: 'string',
        description: 'The layer 2 safe to bridge the tokens from',
      });
      yargs.positional('amount', {
        type: 'number',
        description: 'Amount of tokens you would like bridged (*not* in units of wei)',
      });
      yargs.positional('tokenAddress', {
        type: 'string',
        description: 'The layer 2 token address',
      });
      yargs.positional('receiver', {
        description: 'Layer 1 address to receive the bridged tokens',
        type: 'string',
      });
      command = 'bridgeToL1';
    }
  )
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
  .command('safe-view [safeAddress]', 'View contents of the safe at the specified address', (yargs) => {
    yargs.positional('safeAddress', {
      type: 'string',
      description: 'The address of the safe to view',
    });
    command = 'safeView';
  })
  .command(
    'safe-transfer-tokens [safeAddress] [token] [recipient] [amount]',
    'Transfer tokens from a safe to an arbitrary recipient.',
    (yargs) => {
      yargs.positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe that is sending the tokens',
      });
      yargs.positional('token', {
        type: 'string',
        description: 'The token address of the tokens to transfer from the safe',
      });
      yargs.positional('recipient', {
        type: 'string',
        description: "The token recipient's address",
      });
      yargs.positional('amount', {
        type: 'number',
        description: 'The amount of tokens to transfer (not in units of wei)',
      });
      command = 'safeTransferTokens';
    }
  )
  .command(
    'set-supplier-info-did [safeAddress] [infoDID] [token]',
    'Allows a supplier to customize their appearance within the cardpay ecosystem by letting them set an info DID, that when used with a DID resolver can retrieve supplier info, such as their name, logo, URL, etc.',
    (yargs) => {
      yargs.positional('safeAddress', {
        type: 'string',
        description:
          "The supplier's depot safe address (the safe that was assigned to the supplier when they bridged tokens into L2)",
      });
      yargs.positional('infoDID', {
        type: 'string',
        description: "The DID string that can be resolved to a DID document representing the supplier's information",
      });
      yargs.positional('token', {
        type: 'string',
        description:
          'The token address that you want to use to pay for gas for this transaction. This should be an address of a token in the depot safe.',
      });
      command = 'setSupplierInfoDID';
    }
  )
  .command(
    'prepaidcard-create <safeAddress> <tokenAddress> <customizationDID> <faceValues..>',
    'Create prepaid cards using the specified token from the specified safe with the amounts provided',
    (yargs) => {
      yargs.positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose funds to use to create the prepaid cards',
      });
      yargs.positional('tokenAddress', {
        type: 'string',
        description: 'The token address (defaults to Kovan DAI)',
      });
      yargs.positional('customizationDID', {
        type: 'string',
        description: 'The DID string that represents the prepaid card customization',
      });
      yargs.positional('faceValues', {
        type: 'number',
        description: 'A list of face values (separated by spaces) in units of § SPEND to create',
      });
      command = 'prepaidCardCreate';
    }
  )
  .command(
    'prepaidcard-split <prepaidCard> <customizationDID> <faceValues..>',
    'Split a prepaid card into more prepaid cards',
    (yargs) => {
      yargs.positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card to split',
      });
      yargs.positional('customizationDID', {
        type: 'string',
        description: 'The DID string that represents the prepaid card customization',
      });
      yargs.positional('faceValues', {
        type: 'number',
        description: 'A list of face values (separated by spaces) in units of § SPEND to create',
      });
      command = 'prepaidCardSplit';
    }
  )
  .command('prepaidcard-transfer <prepaidCard> <newOwner>', 'Transfer a prepaid card to a new owner', (yargs) => {
    yargs.positional('prepaidCard', {
      type: 'string',
      description: 'The address of the prepaid card to transfer',
    });
    yargs.positional('newOwner', {
      type: 'string',
      description: 'The address of the new owner',
    });
    command = 'prepaidCardTransfer';
  })
  .command(
    'register-merchant <prepaidCard> <infoDID>',
    'Register as a new merchant by paying a merchant registration fee',
    (yargs) => {
      yargs.positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card that is being used to pay the merchant registration fee',
      });
      yargs.positional('infoDID', {
        type: 'string',
        description: "The DID string that can be resolved to a DID document representing the merchant's information",
      });
      command = 'registerMerchant';
    }
  )
  .command('pay-merchant <merchantSafe> <prepaidCard> <amount>', 'Pay a merchant from a prepaid card.', (yargs) => {
    yargs.positional('merchantSafe', {
      type: 'string',
      description: "The address of the merchant's safe who will receive the payment",
    });
    yargs.positional('prepaidCard', {
      type: 'string',
      description: 'The address of the prepaid card that is being used to pay the merchant',
    });
    yargs.positional('amount', {
      type: 'number',
      description: 'The amount to send to the merchant in units of SPEND',
    });
    command = 'payMerchant';
  })
  .command(
    'revenue-balances <merchantSafe>',
    'View token balances of unclaimed revenue in the revenue pool for a merchant',
    (yargs) => {
      yargs.positional('merchantSafe', {
        type: 'string',
        description: "The address of the merchant's safe whose balances are to be viewed",
      });
      command = 'revenueBalances';
    }
  )
  .command(
    'claim-revenue <merchantSafe> <tokenAddress> <amount>',
    'Claim merchant revenue earned from prepaid card payments',
    (yargs) => {
      yargs.positional('merchantSafe', {
        type: 'string',
        description: "The address of the merchant's safe whose revenue balance is being claimed",
      });
      yargs.positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as revenue',
      });
      yargs.positional('amount', {
        type: 'number',
        description: 'The amount of tokens that are being claimed as revenue (*not* in units of wei)',
      });
      command = 'claimRevenue';
    }
  )
  .command(
    'price-for-face-value <tokenAddress> <spendFaceValue>',
    'Get the price in the units of the specified token to achieve a prepaid card with the specified face value in SPEND',
    (yargs) => {
      yargs.positional('tokenAddress', {
        type: 'string',
        description: 'The token address of the token that will be used to pay for the prepaid card',
      });
      yargs.positional('spendFaceValue', {
        type: 'number',
        description: 'The desired face value in SPEND for the prepaid card',
      });
      command = 'priceForFaceValue';
    }
  )
  .command(
    'new-prepaidcard-gas-fee <tokenAddress>',
    'Get the gas fee in the units of the specified token for creating a new prepaid card.',
    (yargs) => {
      yargs.positional('tokenAddress', {
        type: 'string',
        description: 'The token address of the token that will be used to pay for the prepaid card',
      });
      command = 'gasFee';
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
        type: 'number',
        default: 1,
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
        type: 'number',
        default: 1,
        description: 'The amount of the specified token (*not* in units of wei)',
      });
      command = 'ethPrice';
    }
  )
  .command(
    'price-oracle-updated-at <token>',
    'Get the date that the oracle was last updated for the specified token',
    (yargs) => {
      yargs.positional('token', {
        type: 'string',
        description: 'The token symbol (without the .CPXD suffix)',
      });
      command = 'priceOracleUpdatedAt';
    }
  )
  .command(
    'view-token-balance [tokenAddress]',
    'Get the native token balance for the given wallet tokenAddress and network',
    (yargs) => {
      yargs.positional('tokenAddress', {
        type: 'string',
        description: 'The address of the token to get the balance of. Defaults to native token for network',
      });
      command = 'viewTokenBalance';
    }
  )
  .command(
    'hub-auth [hubRootUrl]',
    'Get an authentication token that can be used to make API requests to a Cardstack Hub server',
    (yargs) => {
      yargs.positional('hubRootUrl', {
        type: 'string',
        description: 'The host name of the hub server to authenticate with',
      });
      command = 'hubAuth';
    }
  )
  .command('reward-balances [address]', 'View token balances of unclaimed rewards in the reward pool.', (yargs) => {
    yargs.positional('address', {
      type: 'string',
      description: 'The address that tally rewarded -- The owner of prepaid card.',
    });
    command = 'rewardTokenBalances';
  })
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
    walletConnect: {
      alias: 'w',
      type: 'boolean',
      description: 'A flag to indicate that wallet connect should be used for the wallet',
    },
  })
  .demandOption(['network'], `'network' must be specified.`)
  .demandCommand(1, 'Please specify a command')
  .help().argv as Options;

if (!mnemonic && !walletConnect) {
  yargs.showHelp(() =>
    console.log(
      'Wallet is not specified. Either specify that wallet connect should be used for the wallet, or specify the mnemonic as a positional arg, or pass the mnemonic in using the MNEMONIC_PHRASE env var'
    )
  );
  process.exit(1);
}
if (walletConnect) {
  mnemonic = undefined;
}

if (!command) {
  throw new Error('missing command--should never get here');
}

(async () => {
  switch (command) {
    case 'bridgeToL2':
      if (amount == null || tokenAddress == null) {
        showHelpAndExit('tokenAddress and amount are required values');
        return;
      }
      await bridgeToLayer2(network, amount, receiver, tokenAddress, mnemonic);
      break;
    case 'awaitBridgedToL2':
      if (fromBlock == null) {
        showHelpAndExit('fromBlock is a required value');
        return;
      }
      await awaitBridged(network, fromBlock, recipient, mnemonic);
      break;
    case 'bridgeToL1':
      if (safeAddress == null || receiver == null || amount == null || tokenAddress == null) {
        showHelpAndExit('safeAddress, receiver, tokenAddress, and amount are required values');
        return;
      }
      await bridgeToLayer1(network, safeAddress, tokenAddress, receiver, amount, mnemonic);
      break;
    case 'safesView':
      await viewSafes(network, address, mnemonic);
      break;
    case 'safeView':
      if (safeAddress == null) {
        showHelpAndExit('safeAddress is a required value');
        return;
      }
      await viewSafe(network, safeAddress, mnemonic);
      break;
    case 'safeTransferTokens':
      if (safeAddress == null || recipient == null || token == null || amount == null) {
        showHelpAndExit('safeAddress, token, recipient, and amount are required values');
        return;
      }
      await transferTokens(network, safeAddress, token, recipient, amount, mnemonic);
      break;
    case 'setSupplierInfoDID':
      if (safeAddress == null || token == null || infoDID == null) {
        showHelpAndExit('safeAddress, token, and infoDID are required values');
        return;
      }
      await setSupplierInfoDID(network, safeAddress, infoDID, token, mnemonic);
      break;
    case 'prepaidCardCreate':
      if (tokenAddress == null || safeAddress == null || faceValues == null) {
        showHelpAndExit('tokenAddress, safeAddress, and faceValues are required values');
        return;
      }
      await createPrepaidCard(network, safeAddress, faceValues, tokenAddress, customizationDID || undefined, mnemonic);
      break;
    case 'prepaidCardSplit':
      if (prepaidCard == null || faceValues == null) {
        showHelpAndExit('prepaidCard and faceValues are required values');
        return;
      }
      await splitPrepaidCard(network, prepaidCard, faceValues, customizationDID || undefined, mnemonic);
      break;
    case 'prepaidCardTransfer':
      if (prepaidCard == null || newOwner == null) {
        showHelpAndExit('prepaidCard and newOwner are required values');
        return;
      }
      await transferPrepaidCard(network, prepaidCard, newOwner, mnemonic);
      break;
    case 'registerMerchant':
      if (prepaidCard == null) {
        showHelpAndExit('prepaidCard is a required value');
        return;
      }
      await registerMerchant(network, prepaidCard, infoDID || undefined, mnemonic);
      break;
    case 'payMerchant':
      if (merchantSafe == null || prepaidCard == null || amount == null) {
        showHelpAndExit('merchantSafe, prepaidCard, and amount are required values');
        return;
      }
      await payMerchant(network, merchantSafe, prepaidCard, amount, mnemonic);
      break;
    case 'revenueBalances':
      if (merchantSafe == null) {
        showHelpAndExit('merchantSafe is a required value');
        return;
      }
      await revenueBalances(network, merchantSafe, mnemonic);
      break;
    case 'claimRevenue':
      if (merchantSafe == null || tokenAddress == null || amount == null) {
        showHelpAndExit('merchantSafe, tokenAddress, and amount are required values');
        return;
      }
      await claimRevenue(network, merchantSafe, tokenAddress, amount, mnemonic);
      break;
    case 'usdPrice':
      if (token == null || amount == null) {
        showHelpAndExit('token and amount are required values');
        return;
      }
      await usdPrice(network, token, amount, mnemonic);
      break;
    case 'ethPrice':
      if (token == null || amount == null) {
        showHelpAndExit('token and amount are required values');
        return;
      }
      await ethPrice(network, token, amount, mnemonic);
      break;
    case 'priceOracleUpdatedAt':
      if (token == null) {
        showHelpAndExit('tokenAddress is a required value');
        return;
      }
      await priceOracleUpdatedAt(network, token, mnemonic);
      break;
    case 'viewTokenBalance':
      await viewTokenBalance(network, tokenAddress, mnemonic);
      break;
    case 'priceForFaceValue':
      if (tokenAddress == null || spendFaceValue == null) {
        showHelpAndExit('tokenAddress and spendFaceValue are required values');
        return;
      }
      await priceForFaceValue(network, tokenAddress, spendFaceValue, mnemonic);
      break;
    case 'gasFee':
      if (tokenAddress == null) {
        showHelpAndExit('token is a required value');
        return;
      }
      await gasFee(network, tokenAddress, mnemonic);
      break;
    case 'hubAuth':
      if (hubRootUrl == null) {
        showHelpAndExit('hubRootUrl is a required value');
        return;
      }
      await hubAuth(hubRootUrl, network, mnemonic);
      break;
    case 'rewardTokenBalances':
      if (address == null) {
        showHelpAndExit('address is a required value');
        return;
      }
      await rewardTokenBalances(network, address, mnemonic);
      break;
    default:
      assertNever(command);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

function showHelpAndExit(msg: string): void {
  yargs.showHelp();
  console.log(`\nERROR: ${msg}`);
  process.exit(1);
}

function assertNever(_value: never): never {
  throw new Error(`not never`);
}
