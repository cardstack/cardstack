import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

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
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, prepaidCard, newOwner } = args as unknown as {
      network: string;
      prepaidCard: string;
      newOwner: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);

    let prepaidCardAPI = await getSDK('PrepaidCard', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Transferring prepaid card ${prepaidCard} to new owner ${newOwner}...`);
    await prepaidCardAPI.transfer(prepaidCard, newOwner, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
