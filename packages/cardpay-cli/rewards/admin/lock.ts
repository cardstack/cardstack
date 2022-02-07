import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'lock <fundingCard> <rewardProgramId>',
  describe: 'Lock reward program',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The prepaid card used to pay for gas for the transaction',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, fundingCard, rewardProgramId } = args as unknown as {
      network: string;
      fundingCard: string;
      rewardProgramId: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.lockRewardProgram(fundingCard, rewardProgramId, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Locked reward program ${rewardProgramId}`);
  },
} as CommandModule;
