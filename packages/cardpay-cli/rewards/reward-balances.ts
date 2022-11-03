import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { displayRewardTokenBalance } from './utils';

export default {
  command: 'reward-balances <address> <rewardProgramId> [safeAddress]',
  describe: 'View token balances of unclaimed rewards in the reward pool',
  builder(yargs: Argv) {
    return yargs
      .positional('address', {
        type: 'string',
        description: 'The address that tally rewarded -- The owner of prepaid card.',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('safeAddress', {
        type: 'string',
        description: 'safe address. Specify if you want gas estimates for each claim',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, address, safeAddress, rewardProgramId } = args as unknown as {
      network: string;
      address: string;
      rewardProgramId: string;
      safeAddress?: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    console.log(`Reward balances for ${address}`);
    if (safeAddress) {
      const tokenBalances = await rewardPool.rewardTokenBalancesWithoutDust(address, rewardProgramId, safeAddress);
      displayRewardTokenBalance(tokenBalances);
    } else {
      const tokenBalances = await rewardPool.rewardTokenBalances(address, rewardProgramId);
      displayRewardTokenBalance(tokenBalances);
    }
  },
} as CommandModule;
