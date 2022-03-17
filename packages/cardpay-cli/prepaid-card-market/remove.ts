import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'remove <fundingCard> <prepaidCards..>',
  describe: 'Removes the specified prepaid cards from the inventory and returns them back to the issuer',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the txn',
      })
      .positional('prepaidCards', {
        type: 'string',
        description: 'A list of prepaid cards (separated by spaces) to remove from inventory',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, fundingCard, prepaidCards, trezor } = args as unknown as {
      network: string;
      fundingCard: string;
      prepaidCards: string[];
      mnemonic?: string;
      trezor?: boolean;
    };

    let web3 = await getWeb3(network, mnemonic, trezor);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);

    console.log(`Removing prepaid cards from inventory ${prepaidCards.join(', ')}...`);
    await prepaidCardMarket.removeFromInventory(fundingCard, prepaidCards, undefined, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
