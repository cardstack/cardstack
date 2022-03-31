import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
const { fromWei } = Web3.utils;

export default {
  command: 'withdraw-from-safe <rewardSafe> <recipient> <tokenAddress> <amount>',
  describe: 'Gas estimate for withdraw from reward safe',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardSafe', {
        type: 'string',
        description: 'The address of the rewardSafe that already contains rewards',
      })
      .positional('recipient', {
        type: 'string',
        description: "The token recipient's address",
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being transferred from reward safe',
      })
      .positional('amount', {
        type: 'string',
        description: 'The amount of tokens to transfer (not in units of wei, but in eth)',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardSafe, recipient, tokenAddress, amount } = args as unknown as {
      network: string;
      rewardSafe: string;
      recipient: string;
      tokenAddress: string;
      amount: string;
    };
    let web3 = await getWeb3(network, getWeb3Opts(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let assets = await getSDK('Assets', web3);
    let { gasToken, amount: estimate } = await rewardManagerAPI.withdrawGasEstimate(
      rewardSafe,
      recipient,
      tokenAddress,
      amount
    );
    let { symbol } = await assets.getTokenInfo(gasToken);
    console.log(`The gas estimate for withdrawing from reward safe ${rewardSafe} is ${fromWei(estimate)} ${symbol}`);
  },
} as CommandModule;
