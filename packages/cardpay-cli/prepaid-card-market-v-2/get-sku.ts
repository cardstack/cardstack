import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'get-sku <issuer> <token> <faceValue> <customizationDID>',
  describe: 'Get the SKU hash',
  builder(yargs: Argv) {
    return yargs
      .positional('issuer', {
        type: 'string',
        description: `Issuer's address`,
      })
      .positional('token', {
        type: 'string',
        description: `Token's address`,
      })
      .positional('faceValue', {
        type: 'number',
        description: `Face value in SPEND`,
      })
      .positional('customizationDID', {
        type: 'string',
        description: `DID string that represents the prepaid card customization`,
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, issuer, token, faceValue, customizationDID } = args as unknown as {
      network: string;
      token: string;
      issuer: string;
      faceValue: number;
      customizationDID: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCardMarketV2 = await getSDK('PrepaidCardMarketV2', web3, signer);

    let sku = await prepaidCardMarketV2.getSKU(issuer, token, faceValue, customizationDID);
    console.log(sku);
  },
} as CommandModule;
