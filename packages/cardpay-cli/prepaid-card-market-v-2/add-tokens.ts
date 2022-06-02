import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'add-tokens <issuerSafe> <issuer> <token> <amount>',
  describe: 'Add tokens to the contract',
  builder(yargs: Argv) {
    return yargs
      .positional('issuerSafe', {
        type: 'string',
        description: 'The safe address used to fund the transfer to the contract',
      })
      .positional('issuer', {
        type: 'string',
        description: 'The address of the issuer',
      })
      .positional('token', {
        type: 'string',
        description: 'The address of the token',
      })
      .positional('amount', {
        type: 'string',
        description: 'How many tokens to transfer',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, issuerSafe, issuer, token, amount } = args as unknown as {
      network: string;
      issuerSafe: string;
      issuer: string;
      amount: string;
      token: string;
    };

    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let blockExplorer = await getConstant('blockExplorer', web3);
    let prepaidCardMarketV2 = await getSDK('PrepaidCardMarketV2', web3, signer);

    await prepaidCardMarketV2.addTokens(issuerSafe, issuer, token, amount, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
