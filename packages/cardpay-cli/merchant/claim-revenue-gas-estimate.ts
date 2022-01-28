import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { fromWei, toWei } from 'web3-utils';

export default {
  command: 'claim-revenue-gas-estimate <merchantSafe> <tokenAddress> <amount>',
  describe: 'Claim merchant revenue earned from prepaid card payments',
  builder(yargs: Argv) {
    return yargs
      .positional('merchantSafe', {
        type: 'string',
        description: "The address of the merchant's safe whose revenue balance is being claimed",
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as revenue',
      })
      .positional('amount', {
        type: 'string',
        description: 'The amount of tokens that are being claimed as revenue (*not* in units of wei, but in eth)',
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, merchantSafe, tokenAddress, amount } = args as unknown as {
      network: string;
      merchantSafe: string;
      tokenAddress: string;
      amount: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let revenuePool = await getSDK('RevenuePool', web3);
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(tokenAddress);
    let weiAmount = toWei(amount);
    let estimate = await revenuePool.claimGasEstimate(merchantSafe, tokenAddress, weiAmount);
    console.log(
      `The gas estimate for claiming ${amount} ${symbol} in revenue for merchant safe ${merchantSafe} is ${fromWei(
        estimate
      )} ${symbol}`
    );
  },
} as CommandModule;
