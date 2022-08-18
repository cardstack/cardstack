import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { displayRewardTokenBalance } from './utils';

export default {
  command: 'pool-balances <rewardProgramId>',
  describe: `View the reward pool's token balances`,
  builder(yargs: Argv) {
    return yargs
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardProgramId } = args as unknown as {
      network: string;
      rewardProgramId: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let rewardTokenBalances = await rewardPool.rewardProgramBalances(rewardProgramId);
    displayRewardTokenBalance(rewardTokenBalances);
  },
} as CommandModule;
