import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'get-rule <rewardProgramId>',
  describe: 'Get JSON rule structure',
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
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    const ruleJson = await rewardManagerAPI.getRuleJson(rewardProgramId);
    console.log(JSON.stringify(ruleJson, null, 2));
  },
} as CommandModule;
