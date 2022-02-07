import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'add-tokens <safeAddress> <rewardProgramId> <tokenAddress> <amount>',
  describe: 'Add Reward Tokens',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose funds to use to fill reward pool',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'Reward program id',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as rewards',
      })
      .positional('amount', {
        type: 'string',
        description: 'The amount of tokens that are being claimed as rewards (*not* in units of wei, but in eth)',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, safeAddress, rewardProgramId, tokenAddress, amount } = args as unknown as {
      network: string;
      safeAddress: string;
      rewardProgramId: string;
      tokenAddress: string;
      amount: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardPool = await getSDK('RewardPool', web3);
    let assets = await getSDK('Assets', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardPool.addRewardTokens(safeAddress, rewardProgramId, tokenAddress, amount, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    let { symbol } = await assets.getTokenInfo(tokenAddress);
    console.log(`Added ${amount} of token ${symbol} to reward program ${rewardProgramId}`);
  },
} as CommandModule;
