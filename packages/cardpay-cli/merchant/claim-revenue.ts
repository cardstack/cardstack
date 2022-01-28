import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { toWei } from 'web3-utils';

export default {
  command: 'claim-revenue <merchantSafe> <tokenAddress> <amount>',
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
    console.log(`Claiming ${amount} ${symbol} in revenue for merchant safe ${merchantSafe}`);

    let blockExplorer = await getConstant('blockExplorer', web3);
    await revenuePool.claim(merchantSafe, tokenAddress, weiAmount, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
