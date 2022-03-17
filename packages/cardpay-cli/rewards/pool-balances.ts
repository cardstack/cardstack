import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
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
    let { network, mnemonic, rewardProgramId, trezor } = args as unknown as {
      network: string;
      rewardProgramId: string;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let rewardPool = await getSDK('RewardPool', web3);
    let rewardTokenBalances = await rewardPool.balances(rewardProgramId);
    displayRewardTokenBalance(rewardTokenBalances);
  },
} as CommandModule;
