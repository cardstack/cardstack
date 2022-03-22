import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_1, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import Web3 from 'web3';
const { toWei } = Web3.utils;

export default {
  command: 'to-l2 <amount> <tokenAddress> [receiver]',
  describe: 'Bridge tokens to the layer 2 network',
  builder(yargs: Argv) {
    return yargs
      .positional('amount', {
        type: 'string',
        description: 'Amount of tokens you would like bridged (*not* in units of wei, but in eth)',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The layer 1 token address',
      })
      .positional('receiver', {
        description: 'Layer 2 address to be the owner of L2 safe, defaults to same as L1 address',
        type: 'string',
      })
      .options({
        network: NETWORK_OPTION_LAYER_1,
      });
  },
  async handler(args: Arguments) {
    let { network, receiver, amount, tokenAddress } = args as unknown as {
      network: string;
      receiver?: string;
      amount: string;
      tokenAddress: string;
    };
    const amountInWei = toWei(amount);

    let web3 = await getWeb3(network, getWeb3Opts(args));
    let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(tokenAddress);
    receiver = receiver ?? (await web3.eth.getAccounts())[0];

    let blockExplorer = await getConstant('blockExplorer', web3);

    {
      console.log(`Sending approve transaction request for ${amount} ${symbol}`);
      await tokenBridge.unlockTokens(tokenAddress, amountInWei, {
        onTxnHash: (txnHash) => console.log(`Approve transaction hash: ${blockExplorer}/tx/${txnHash}`),
      });
      console.log('completed approval');
    }

    {
      console.log(
        `Sending relay tokens transaction request for ${amount} ${symbol} into layer 2 safe owned by ${receiver}`
      );
      await tokenBridge.relayTokens(tokenAddress, receiver, amountInWei, {
        onTxnHash: (txnHash) => console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${txnHash}`),
      });
      console.log('completed relay');
    }
  },
} as CommandModule;
