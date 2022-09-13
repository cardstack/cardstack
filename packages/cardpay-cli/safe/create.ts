import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'create [threshold] [tokenAddress] [owners...]',
  describe: 'Create new safe',
  builder(yargs: Argv) {
    return yargs
      .positional('threshold', {
        type: 'number',
        description: 'threshold of safe signature',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The token address (defaults to Kovan DAI)',
      })
      .positional('owners', {
        type: 'string',
        description: 'The address of owners (separated by spaces)',
      })
      .option('saltNonce', {
        type: 'string',
        description: 'Salt nonce',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { owners, threshold, tokenAddress, saltNonce, network } = args as unknown as {
      owners: string[];
      threshold: number;
      tokenAddress: string;
      saltNonce: string;
      network: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let safesApi = await getSDK('Safes', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Create a new safe...`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    let { safeAddress } = await safesApi.createSafe(tokenAddress, owners, threshold, saltNonce, { onTxnHash });
    if (!safeAddress) {
      console.log(`Failed to deploy a new safe`);
    } else {
      console.log(`Safe deployed to: ${safeAddress}`);
    }
  },
} as CommandModule;
