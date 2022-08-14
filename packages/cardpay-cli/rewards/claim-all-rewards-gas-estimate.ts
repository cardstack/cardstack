import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
const { fromWei } = Web3.utils;

export default {
  command: 'claim-all-rewards-gas-estimate <rewardSafe> <rewardProgramId> <tokenAddress>',
  describe: 'Obtain a gas estimate to claim all rewards corresponding to a rewardProgrmaId and tokenAddress',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardSafe', {
        type: 'string',
        description: 'The address of the rewardSafe which will receive the rewards',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as rewards',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardSafe, rewardProgramId, tokenAddress } = args as unknown as {
      network: string;
      rewardSafe: string;
      rewardProgramId: string;
      tokenAddress: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let assets = await getSDK('Assets', web3);
    let { gasToken, amount } = await rewardPool.claimAllGasEstimate(rewardSafe, rewardProgramId, tokenAddress);
    let { symbol } = await assets.getTokenInfo(gasToken);
    console.log(
      `The gas estimate for claiming ALL rewards to reward safe ${rewardSafe} is ${fromWei(amount)} ${symbol}`
    );
  },
} as CommandModule;
