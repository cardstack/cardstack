import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { formatPrepaidCards, inventoryInfo } from './utils';

export default {
  command: 'split <prepaidCard> <customizationDID> <faceValues..>',
  describe: `Split a prepaid card into more prepaid cards (max 10) and place in the default market`,
  builder(yargs: Argv) {
    return yargs
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card to split',
      })
      .positional('customizationDID', {
        type: 'string',
        description: 'The DID string that represents the prepaid card customization',
      })
      .positional('faceValues', {
        type: 'number',
        description: 'A list of face values (separated by spaces) in units of § SPEND to create',
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, prepaidCard, customizationDID, faceValues } = args as unknown as {
      network: string;
      prepaidCard: string;
      faceValues: number[];
      customizationDID: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let prepaidCardAPI = await getSDK('PrepaidCard', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    console.log(
      `Splitting prepaid card ${prepaidCard} into face value(s) §${faceValues.join(
        ' SPEND, §'
      )} SPEND with customizationDID ${customizationDID} and placing into the default market...`
    );
    let { prepaidCards, sku } = await prepaidCardAPI.split(prepaidCard, faceValues, undefined, customizationDID, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });

    await inventoryInfo(web3, sku);

    console.log(`
  Created cards: ${formatPrepaidCards(prepaidCards.map((p) => p.address))}
  
  done
  `);
  },
} as CommandModule;
