import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { FROM_OPTION, getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { ContractOptions } from 'web3-eth-contract';

export default {
  command: 'transfer <prepaidCard> <newOwner>',
  describe: 'Transfer a prepaid card to a new owner',
  builder(yargs: Argv) {
    return yargs
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card to transfer',
      })
      .positional('newOwner', {
        type: 'string',
        description: 'The address of the new owner',
      })
      .option('from', FROM_OPTION)
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, prepaidCard, newOwner, from } = args as unknown as {
      network: string;
      prepaidCard: string;
      newOwner: string;
      from?: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));

    let prepaidCardAPI = await getSDK('PrepaidCard', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Transferring prepaid card ${prepaidCard} to new owner ${newOwner}...`);
    let contractOptions = {} as ContractOptions;
    if (from) {
      contractOptions.from = from;
    }
    await prepaidCardAPI.transfer(
      prepaidCard,
      newOwner,
      {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      },
      contractOptions
    );
    console.log('done');
  },
} as CommandModule;
