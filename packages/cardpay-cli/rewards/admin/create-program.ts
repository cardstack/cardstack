import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'create-program <prepaidCard> <admin>',
  describe: 'Register reward program',
  builder(yargs: Argv) {
    return yargs
      .positional('admin', {
        type: 'string',
        description: 'The address of the new admin. This is an EOA',
      })
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card that is being used to pay the reward program registration fee',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, prepaidCard, admin } = args as unknown as {
      network: string;
      prepaidCard: string;
      admin: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let { rewardProgramId } = await rewardManagerAPI.registerRewardProgram(prepaidCard, admin, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Registered reward program ${rewardProgramId} with admin ${admin}`);
  },
} as CommandModule;
