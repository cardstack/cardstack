import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { displayRewardProgramInfo } from './utils';

export default {
  command: 'view <rewardProgramId>',
  describe: 'Get info about a reward program',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardProgramId', {
        type: 'string',
        description: 'Reward program id',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardProgramId } = args as unknown as {
      network: string;
      rewardProgramId: string;
    };
    let web3 = await getWeb3(network, getWeb3Opts(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    const rewardProgramInfo = await rewardManagerAPI.getRewardProgramInfo(rewardProgramId);
    displayRewardProgramInfo(rewardProgramInfo);
  },
} as CommandModule;
