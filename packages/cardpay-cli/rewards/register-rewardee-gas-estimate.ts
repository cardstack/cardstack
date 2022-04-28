import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType, FROM_OPTION } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { fromWei } from 'web3-utils';

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
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardManager = await getSDK('RewardManager', web3);
    let assets = await getSDK('Assets', web3);
    let { gasToken, amount } = await rewardManager.registerRewardeeGasEstimate(prepaidCard, rewardProgramId);
    let { symbol } = await assets.getTokenInfo(gasToken);
    console.log(`The gas estimate for registering a rewardee is ${fromWei(amount)} ${symbol}`);
  },
} as CommandModule;
