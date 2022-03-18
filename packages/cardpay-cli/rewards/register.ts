import { Argv } from 'yargs';
import { FROM_OPTION, getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'register <prepaidCard> <rewardProgramId>',
  describe: 'Register rewardee',
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
    let { network, mnemonic, prepaidCard, rewardProgramId, from } = args as unknown as {
      network: string;
      prepaidCard: string;
      rewardProgramId: string;
      mnemonic?: string;
      from?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let { rewardSafe } = await rewardManagerAPI.registerRewardee(
      prepaidCard,
      rewardProgramId,
      {
        onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      },
      { from }
    );
    console.log(`Registered rewardee for reward program ${rewardProgramId}. Created reward safe: ${rewardSafe}`);
  },
} as CommandModule;
