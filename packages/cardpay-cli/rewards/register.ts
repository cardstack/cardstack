import { Argv } from 'yargs';
import { FROM_OPTION, getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
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
    let { network, prepaidCard, rewardProgramId, from } = args as unknown as {
      network: string;
      prepaidCard: string;
      rewardProgramId: string;
      from?: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
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
