import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import Web3 from 'web3';
const { toWei } = Web3.utils;

export default {
  command: 'to-l1 <safeAddress> <amount> <tokenAddress> <receiver>',
  describe: 'Bridge tokens to the layer 1 network',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The layer 2 safe to bridge the tokens from',
      })
      .positional('amount', {
        type: 'string',
        description: 'Amount of tokens you would like bridged (*not* in units of wei, but in eth)',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The layer 2 token address',
      })
      .positional('receiver', {
        description: 'Layer 1 address to receive the bridged tokens',
        type: 'string',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, safeAddress, receiver, amount, tokenAddress } = args as unknown as {
      network: string;
      mnemonic: string;
      safeAddress: string;
      receiver: string;
      amount: string;
      tokenAddress: string;
    };

    const amountInWei = toWei(amount);

    let web3 = await getWeb3(network, mnemonic);
    let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(tokenAddress);
    receiver = receiver ?? (await web3.eth.getAccounts())[0];

    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Bridging ${amount} ${symbol} from layer 2 safe ${safeAddress} to layer 1 account ${receiver}...`);
    let result = await tokenBridge.relayTokens(safeAddress, tokenAddress, receiver, amountInWei.toString());
    console.log(`Approve transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  },
} as CommandModule;
