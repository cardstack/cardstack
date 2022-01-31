import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'withdraw-from-safe <rewardSafe> <recipient> <tokenAddress> <amount>',
  describe: 'Withdraw from reward safe',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardSafe', {
        type: 'string',
        description: 'The address of the rewardSafe that already contains rewards',
      })
      .positional('recipient', {
        type: 'string',
        description: "The token recipient's address",
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being transferred from reward safe',
      })
      .positional('amount', {
        type: 'string',
        description: 'The amount of tokens to transfer (not in units of wei, but in eth)',
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, rewardSafe, recipient, tokenAddress, amount } = args as unknown as {
      network: string;
      rewardSafe: string;
      recipient: string;
      tokenAddress: string;
      amount: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardManagerAPI = await getSDK('RewardManager', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    await rewardManagerAPI.withdraw(rewardSafe, recipient, tokenAddress, amount, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Withdraw ${amount} of ${tokenAddress} out of ${rewardSafe} to ${recipient}`);
  },
} as CommandModule;
