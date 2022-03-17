import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstantByNetwork, getSDK, ERC20ABI } from '@cardstack/cardpay-sdk';
import { AbiItem } from 'web3-utils';

export default {
  command: 'token-balance [tokenAddress]',
  describe: 'Get the native token balance for the given wallet tokenAddress and network',
  builder(yargs: Argv) {
    return yargs
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the token to get the balance of. Defaults to native token for network',
      })
      .options({
        network: NETWORK_OPTION_ANY,
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, tokenAddress, trezor } = args as unknown as {
      network: string;
      tokenAddress?: string;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let assets = await getSDK('Assets', web3);

    if (!tokenAddress) {
      const nativeTokenSymbol = getConstantByNetwork('nativeTokenSymbol', network);

      const balance = await assets.getNativeTokenBalance();

      console.log(`${nativeTokenSymbol} balance - ${web3.utils.fromWei(balance)}`);
    } else {
      const balance = await assets.getBalanceForToken(tokenAddress);
      const tokenContract = new web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
      const tokenSymbol = await tokenContract.methods.symbol().call();

      console.log(`${tokenSymbol} balance - ${web3.utils.fromWei(balance)}`);
    }
  },
} as CommandModule;
