import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'recover-reward-tokens <safeAddress> <rewardProgramId> <tokenAddress> [amount]',
  describe: `Recover reward tokens from reward pool`,
  builder(yargs: Argv) {
    return yargs
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being recovered from reward pool',
      })
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe that is to receive the recovered tokens',
      })
      .positional('amount', {
        type: 'string',
        description: 'The amount of tokens to recover into safe',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, rewardProgramId, tokenAddress, safeAddress, amount, trezor } = args as unknown as {
      network: string;
      rewardProgramId: string;
      tokenAddress: string;
      safeAddress: string;
      amount?: string;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let rewardPool = await getSDK('RewardPool', web3);
    let assets = await getSDK('Assets', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardPool.recoverTokens(safeAddress, rewardProgramId, tokenAddress, amount, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    let { symbol } = await assets.getTokenInfo(tokenAddress);
    console.log(
      `Recover ${amount ? amount : ''} ${symbol} for reward program id ${rewardProgramId} to safe ${safeAddress}`
    );
  },
} as CommandModule;
