import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import Web3 from 'web3';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
const { toWei } = Web3.utils;

export default {
  command: 'eth <token> [amount]',
  describe: 'Get the ETH value for the specified token in the specified amount',
  builder(yargs: Argv) {
    return yargs
      .positional('token', {
        type: 'string',
        description: 'The token symbol (without the .CPXD suffix)',
      })
      .positional('amount', {
        type: 'string',
        default: '1',
        description: 'The amount of the specified token (*not* in units of wei, but in eth)',
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, token, amount } = args as unknown as {
      network: string;
      token: string;
      amount: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let amountInWei = toWei(amount);
    let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
    let ethWeiPrice = await layerTwoOracle.getETHPrice(token, amountInWei);
    console.log(`ETH value: ${fromWei(ethWeiPrice)} ETH`);
  },
} as CommandModule;
