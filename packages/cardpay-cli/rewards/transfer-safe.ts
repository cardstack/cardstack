import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'transfer-safe <rewardSafe> <newOwner>',
  describe: 'Withdraw from reward safe',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardSafe', {
        type: 'string',
        description: 'The address of the rewardSafe that already contains rewards',
      })
      .positional('newOwner', {
        type: 'string',
        description: 'The address of the new owner',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, rewardSafe, newOwner } = args as unknown as {
      network: string;
      rewardSafe: string;
      newOwner: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.transfer(rewardSafe, newOwner, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Transfer reward safe ${rewardSafe} ownership to ${newOwner}`);
  },
} as CommandModule;
