import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { displayRewardTokenBalance } from './utils';

export default {
  command: 'reward-balances <address>',
  describe: 'View token balances of unclaimed rewards in the reward pool',
  builder(yargs: Argv) {
    return yargs
      .positional('address', {
        type: 'string',
        description: 'The address that tally rewarded -- The owner of prepaid card.',
      })
      .option('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, address, rewardProgramId } = args as unknown as {
      network: string;
      address: string;
      rewardProgramId?: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardPool = await getSDK('RewardPool', web3);
    const tokenBalances = await rewardPool.rewardTokenBalances(address, rewardProgramId);
    console.log(`Reward balances for ${address}`);
    displayRewardTokenBalance(tokenBalances);
  },
} as CommandModule;
