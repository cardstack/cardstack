import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import Web3 from 'web3';
const { toWei } = Web3.utils;

export default {
  command: 'transfer-tokens [safeAddress] [token] [recipient] [amount]',
  describe: 'Transfer tokens from a safe to an arbitrary recipient',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe that is sending the tokens',
      })
      .positional('token', {
        type: 'string',
        description: 'The token address of the tokens to transfer from the safe',
      })
      .positional('recipient', {
        type: 'string',
        description: "The token recipient's address",
      })
      .option('amount', {
        type: 'string',
        description: 'The amount of tokens to transfer (not in units of wei, but in eth)',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, token, safeAddress, recipient, amount } = args as unknown as {
      network: string;
      safeAddress: string;
      token: string;
      recipient: string;
      amount?: string;
    };
    let web3 = await getWeb3(network, getWeb3Opts(args));
    let safes = await getSDK('Safes', web3);
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(token);
    let blockExplorer = await getConstant('blockExplorer', web3);
    if (amount) {
      let weiAmount = toWei(amount);
      console.log(`transferring ${amount} ${symbol} from safe ${safeAddress} to ${recipient}`);
      await safes.sendTokens(safeAddress, token, recipient, weiAmount, {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      });
    } else {
      console.log(`transferring ALL ${symbol} from safe ${safeAddress} to ${recipient}`);
      await safes.sendTokens(safeAddress, token, recipient, undefined, {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      });
    }
  },
} as CommandModule;
