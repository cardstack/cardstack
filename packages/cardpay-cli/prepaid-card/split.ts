import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { FROM_OPTION, getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { formatPrepaidCards, inventoryInfo } from './utils';
import { ContractOptions } from 'web3-eth-contract';

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
      })
      .option('from', FROM_OPTION)
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, prepaidCard, customizationDID, faceValues, from } = args as unknown as {
      network: string;
      prepaidCard: string;
      faceValues: number[];
      customizationDID: string;
      from?: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCardAPI = await getSDK('PrepaidCard', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    console.log(
      `Splitting prepaid card ${prepaidCard} into face value(s) §${faceValues.join(
        ' SPEND, §'
      )} SPEND with customizationDID ${customizationDID} and placing into the default market...`
    );
    let contractOptions = {} as ContractOptions;
    if (from) {
      contractOptions.from = from;
    }
    let { prepaidCards, sku } = await prepaidCardAPI.split(
      prepaidCard,
      faceValues,
      undefined,
      customizationDID,
      {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      },
      contractOptions
    );

    await inventoryInfo(web3, sku);

    console.log(`
  Created cards: ${formatPrepaidCards(prepaidCards.map((p) => p.address))}
  
  done
  `);
  },
} as CommandModule;
