import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
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
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, prepaidCard, rewardProgramId } = args as unknown as {
      network: string;
      prepaidCard: string;
      rewardProgramId: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let { rewardSafe } = await rewardManagerAPI.registerRewardee(prepaidCard, rewardProgramId, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Registered rewardee for reward program ${rewardProgramId}. Created reward safe: ${rewardSafe}`);
  },
} as CommandModule;
