import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { displayRewardProgramInfo } from './utils';

export default {
  command: 'list',
  describe: 'List reward programs',
  builder(yargs: Argv) {
    return yargs.options({
      network: NETWORK_OPTION_LAYER_2,
    });
  },
  async handler(args: Arguments) {
    let { network, mnemonic } = args as unknown as {
      network: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let rewardProgramInfos = await rewardManagerAPI.getRewardProgramsInfo();
    rewardProgramInfos.map((rewardProgramInfo) => displayRewardProgramInfo(rewardProgramInfo));
  },
} as CommandModule;
