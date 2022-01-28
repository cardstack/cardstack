import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { displayRewardProgramInfo } from './utils';

export default {
  command: 'list',
  describe: 'List reward programs',
  builder: {},
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
