import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'add <fundingCard> <prepaidCard>',
  describe: 'Adds a prepaid card to the inventory',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the txn',
      })
      .positional('prepaidCard', {
        type: 'string',
        description: 'The prepaid card to add to the inventory',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, prepaidCard } = args as unknown as {
      network: string;
      fundingCard: string;
      prepaidCard: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let blockExplorer = await getConstant('blockExplorer', web3);
    let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3, signer);

    console.log(`Adding prepaid card to inventory ${prepaidCard}...`);
    await prepaidCardMarket.addToInventory(fundingCard, prepaidCard, undefined, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
