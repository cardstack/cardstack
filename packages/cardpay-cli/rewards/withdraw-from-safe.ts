import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { toWei } from 'web3-utils';

export default {
  command: 'withdraw-from-safe <rewardSafe> <recipient> <tokenAddress> [amount]',
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
      .option('amount', {
        type: 'string',
        description: 'The amount of tokens to transfer (not in units of wei, but in eth)',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardSafe, recipient, tokenAddress, amount } = args as unknown as {
      network: string;
      rewardSafe: string;
      recipient: string;
      tokenAddress: string;
      amount?: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardManagerAPI = await getSDK('RewardManager', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    if (amount) {
      await rewardManagerAPI.withdraw(rewardSafe, recipient, tokenAddress, toWei(amount), {
        onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      });
      console.log(`Withdraw ${amount} of ${tokenAddress} out of ${rewardSafe} to ${recipient}`);
    } else {
      await rewardManagerAPI.withdraw(rewardSafe, recipient, tokenAddress, undefined, {
        onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      });
      console.log(`Withdraw ALL of ${tokenAddress} out of ${rewardSafe} to ${recipient}`);
    }
  },
} as CommandModule;
