import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'add-rule <fundingCard> <rewardProgramId> <blob>',
  describe: 'Add a rule to a reward program',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the txn',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .positional('blob', {
        type: 'string',
        description: 'Hex encoding of rule blob',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, rewardProgramId, blob } = args as unknown as {
      network: string;
      fundingCard: string;
      rewardProgramId: string;
      blob: string;
    };
    let web3 = await getWeb3(network, getWeb3Opts(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.addRewardRule(fundingCard, rewardProgramId, blob, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Updated reward rule of reward program ${rewardProgramId} to ${blob}`);
  },
} as CommandModule;
