import { Argv } from 'yargs';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'withdrawal-limits <token>',
  describe: 'Get the withdrawal limits for bridging a token to layer 1',
  builder(yargs: Argv) {
    return yargs
      .positional('token', {
        type: 'string',
        description: 'The layer 2 CPXD token address of the token being withdrawn',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, token } = args as unknown as {
      network: string;
      mnemonic: string;
      token: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
    let { max, min } = await tokenBridge.getWithdrawalLimits(token);
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(token);
    console.log(`The withdrawal limits for bridging ${symbol} to layer 1 are:
    minimum withdrawal ${fromWei(min)} ${symbol}
    maximum withdrawal ${fromWei(max)} ${symbol}`);
  },
} as CommandModule;
