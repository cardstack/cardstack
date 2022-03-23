import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts, FROM_OPTION } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { fromWei} from 'web3-utils';

export default {
  command: 'register-rewardee-gas-estimate <prepaidCard> <rewardProgramId>',
  describe: 'Obtain a gas estimate to register rewardee from prepaid card payments',
  builder(yargs: Argv) {
    return yargs
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card that is being used to pay the merchant',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'Reward program id',
      })
      .option('from', FROM_OPTION)
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, prepaidCard, rewardProgramId } = args as unknown as {
      network: string;
      prepaidCard: string;
      rewardProgramId: string;
    };
    let web3 = await getWeb3(network, getWeb3Opts(args));
    let rewardManager = await getSDK('RewardManager', web3);
    let estimate = await rewardManager.registerRewardeeGasEstimate(
        prepaidCard, rewardProgramId
    )
    console.log(
      `The gas estimate for registering a rewardee for ${rewardProgramId} is
      ${fromWei(
        estimate
      )}`
    );
  },
} as CommandModule;
