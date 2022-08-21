import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'claim-all <rewardSafe> <rewardProgramId> <tokenAddress>',
  describe: 'claim all token rewards from a reward program',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardSafe', {
        type: 'string',
        description: 'The address of the rewardSafe which will receive the rewards',
      })
      .option('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as rewards',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardSafe, rewardProgramId, tokenAddress } = args as unknown as {
      network: string;
      rewardSafe: string;
      rewardProgramId?: string;
      tokenAddress?: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let rewardManager = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let safeOwner = await rewardManager.getRewardSafeOwner(rewardSafe);
    let unclaimedValidProofs = await rewardPool.getProofs(safeOwner, rewardSafe, rewardProgramId, tokenAddress, false);
    const receipts = await rewardPool.claimAll(unclaimedValidProofs);
    receipts.forEach((receipt) => {
      console.log(`Transaction hash: ${blockExplorer}/tx/${receipt.transactionHash}/token-transfers`);
    });
    console.log(`Claimed ALL rewards of reward program ${rewardProgramId} to reward safe ${rewardSafe}`);
  },
} as CommandModule;
