import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
const { toWei } = Web3.utils;

export default {
  command: 'set-ask <fundingCard> <sku> <askPrice>',
  describe:
    'Set the asking price for a SKU. The ask price is in units of eth in the issuing token for prepaid cards within the SKU',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the txn',
      })
      .positional('sku', {
        type: 'string',
        description: 'The SKU whose ask price is being set',
      })
      .positional('askPrice', {
        type: 'number',
        description:
          'The ask price for the prepaid cards in the SKU in units of eth in the issuing token for the prepaid cards within the SKU',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, sku, askPrice } = args as unknown as {
      network: string;
      fundingCard: string;
      sku: string;
      askPrice: number;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let blockExplorer = await getConstant('blockExplorer', web3);
    let prepaidCardMarketV2 = await getSDK('PrepaidCardMarketV2', web3, signer);
    let assets = await getSDK('Assets', web3);
    let skuInfo = await prepaidCardMarketV2.getSKUInfo(sku);
    if (!skuInfo) {
      console.log(`The SKU ${sku} does not exist in the market contract`);
    } else {
      let { issuingToken } = skuInfo;
      let { symbol } = await assets.getTokenInfo(issuingToken);
      console.log(`Setting ask price for SKU ${sku} to ${askPrice} ${symbol}...`);
      await prepaidCardMarketV2.setAsk(fundingCard, sku, toWei(askPrice.toString()), {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      });
      console.log('done');
    }
  },
} as CommandModule;
