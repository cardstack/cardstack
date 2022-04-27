import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
const { fromWei, toWei } = Web3.utils;

export default {
  command: 'withdraw-gas-estimate <rewardSafe> <recipient> <tokenAddress> <amount>',
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
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
    let assets = await getSDK('Assets', web3);
    let { gasToken, amount: estimate } = await rewardManagerAPI.withdrawGasEstimate(
      rewardSafe,
      recipient,
      tokenAddress,
      toWei(amount)
    );
    let { symbol } = await assets.getTokenInfo(gasToken);
    console.log(`The gas estimate for withdrawing from reward safe ${rewardSafe} is ${fromWei(estimate)} ${symbol}`);
  },
} as CommandModule;
