import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'set-admin <fundingCard> <rewardProgramId> <newAdmin>',
  describe: 'Update reward program admin',
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
      .positional('newAdmin', {
        type: 'string',
        description: 'The EOA admin of reward program',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fundingCard, rewardProgramId, newAdmin } = args as unknown as {
      network: string;
      fundingCard: string;
      rewardProgramId: string;
      newAdmin: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.updateRewardProgramAdmin(fundingCard, rewardProgramId, newAdmin, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Updated admin of reward program ${rewardProgramId} to ${newAdmin}`);
  },
} as CommandModule;
