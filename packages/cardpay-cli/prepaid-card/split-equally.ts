import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { formatPrepaidCards, inventoryInfo } from './utils';

export default {
  command: 'split-equally <prepaidCard> <faceValue> <quantity>',
  describe: `Split a prepaid card into more prepaid cards with identical face values inheriting the funding card's customization and place in the default market`,
  builder(yargs: Argv) {
    return yargs
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card to split',
      })
      .positional('faceValue', {
        type: 'number',
        description: 'The face value for the new prepaid cards',
      })
      .positional('quantity', {
        type: 'number',
        description: 'The amount of prepaid cards to create',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, prepaidCard, quantity, faceValue } = args as unknown as {
      network: string;
      prepaidCard: string;
      faceValue: number;
      quantity: number;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);

    let prepaidCardAPI = await getSDK('PrepaidCard', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let customizationDID = await prepaidCardAPI.customizationDID(prepaidCard);
    console.log(
      `Splitting prepaid card ${prepaidCard} into ${quantity} new prepaid cards with a face value §${faceValue} SPEND and customization DID ${
        customizationDID || '-none-'
      } and placing into the default market...`
    );
    let cardsLeft = quantity;
    let sku: string | undefined;
    let allCards: string[] = [];
    try {
      do {
        console.log(
          `  Progress: ${quantity - cardsLeft} of ${quantity} (${Math.round(
            ((quantity - cardsLeft) / quantity) * 100
          )}%)`
        );
        let currentNumberOfCards = Math.min(cardsLeft, 10);
        let faceValues = Array(currentNumberOfCards).fill(faceValue);
        let prepaidCards;
        ({ prepaidCards, sku } = await prepaidCardAPI.split(prepaidCard, faceValues, undefined, customizationDID, {
          onTxnHash: (txnHash) => console.log(`  Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
        }));
        allCards.push(...prepaidCards.map((p) => p.address));

        cardsLeft -= currentNumberOfCards;
      } while (cardsLeft > 0);
      console.log(
        `  Progress: ${quantity - cardsLeft} of ${quantity} (${Math.round(((quantity - cardsLeft) / quantity) * 100)}%)`
      );
    } catch (err) {
      console.log(`Encountered error while performing split.`);
      if (allCards.length > 0 && sku) {
        console.log(
          `Successfully created the following prepaid cards before error was encountered: ${formatPrepaidCards(
            allCards
          )}`
        );
        await inventoryInfo(web3, sku);
      } else {
        console.log(`No cards were created`);
      }
      throw err;
    }
    console.log(`
    Created ${allCards.length} new prepaid cards
    Balance of ${prepaidCard}: §${await prepaidCardAPI.faceValue(prepaidCard)} SPEND
    `);
    await inventoryInfo(web3, sku);
  },
} as CommandModule;
