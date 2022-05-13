import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'add-sku <fundingCard> <issuerSafe> <faceValue> <customizationDID> <issuingToken>',
  describe: 'Add a SKU',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the txn',
      })
      .positional('issuerSafe', {
        type: 'string',
        description: 'The address of the issuer safe',
      })
      .positional('faceValue', {
        type: 'number',
        description: 'The face value for the new prepaid cards',
      })
      .positional('customizationDID', {
        type: 'string',
        description: 'The DID string that represents the prepaid card customization',
      })
      .positional('issuingToken', {
        type: 'string',
        description: 'The address of the issuing token',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, issuerSafe, faceValue, customizationDID, issuingToken } = args as unknown as {
      network: string;
      fundingCard: string;
      issuerSafe: string;
      faceValue: number;
      customizationDID: string;
      issuingToken: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let blockExplorer = await getConstant('blockExplorer', web3);
    let prepaidCardMarketV2 = await getSDK('PrepaidCardMarketV2', web3, signer);

    await prepaidCardMarketV2.addSKU(fundingCard, issuerSafe, faceValue, customizationDID, issuingToken, undefined, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
