import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'get-explanation <rewardProgramId> [explanationId]',
  describe: `Get explanation for reward program and translation definitions`,
  builder(yargs: Argv) {
    return yargs
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('explanationId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardProgramId, explanationId } = args as unknown as {
      network: string;
      rewardProgramId: string;
      explanationId?: string;
    };
    const { web3 } = await getEthereumClients(network, getConnectionType(args));
    const rewardPool = await getSDK('RewardManager', web3);
    const rule = await rewardPool.getRuleJson(rewardProgramId);
    const programExplainer = await rewardPool.getProgramExplainer(rule);
    console.log(
      `
        Program Explainer:
            ${programExplainer}
        `
    );
    if (explanationId) {
      const explanationTemplate = await rewardPool.getClaimExplainer(rule, explanationId);
      console.log(
        `
        Claim Explainer template:
            ${explanationTemplate ?? '  Not specified'}
        `
      );
    }
  },
} as CommandModule;
