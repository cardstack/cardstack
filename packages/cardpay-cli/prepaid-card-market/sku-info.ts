import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import Web3 from 'web3';
import { getSDK } from '@cardstack/cardpay-sdk';
const { fromWei } = Web3.utils;

export default {
  command: 'sku-info <sku>',
  describe: 'Get the details for the prepaid cards available in the market contract for the specified SKU',
  builder(yargs: Argv) {
    return yargs.positional('sku', {
      type: 'string',
      description: 'The SKU to obtain details for',
    });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, sku } = args as unknown as {
      network: string;
      sku: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
    let assets = await getSDK('Assets', web3);
    let skuInfo = await prepaidCardMarket.getSKUInfo(sku);
    let inventory = await prepaidCardMarket.getInventory(sku);
    if (!skuInfo) {
      console.log(`The SKU ${sku} does not exist in the market contract`);
    } else {
      let { issuer, issuingToken, faceValue, customizationDID, askPrice } = skuInfo;
      let { symbol } = await assets.getTokenInfo(issuingToken);
      console.log(`SKU ${sku}:
      Issuer: ${issuer}
      Issuing token: ${issuingToken} (${symbol})
      Face value: §${faceValue} SPEND
      Customization DID: ${customizationDID || '-none-'}
      Ask price: ${fromWei(askPrice)} ${symbol}
      Quantity: ${inventory.length}`);
    }
  },
} as CommandModule;
