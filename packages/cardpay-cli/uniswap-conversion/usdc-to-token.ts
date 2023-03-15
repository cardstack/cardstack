import { Argv } from 'yargs';
import { getUsdcToTokenRate } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { applyRateToAmount } from '@cardstack/cardpay-sdk';
import { BigNumber, utils as ethersUtils } from 'ethers';

export default {
  command: 'usdc-to-token <tokenAddress> <amount> <invert>',
  describe: 'Convert native token amount to units of any other token',
  builder(yargs: Argv) {
    return yargs
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the token to be converted from/to native token',
      })
      .positional('amount', {
        type: 'string',
        description:
          'The amount of given token to be converted to units of native token. When inverted, the amount of native token to be converted to units of provided token. The converted amount is normalized to the smallest amount of decimals of the two tokens.',
      })
      .positional('invert', {
        type: 'boolean',
        description: 'Invert the conversion (default: false)',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, tokenAddress, amount, invert } = args as unknown as {
      network: string;
      tokenAddress: string;
      amount: string;
      invert: boolean;
    };
    let { ethersProvider } = await getEthereumClients(network, getConnectionType(args));

    console.log(`Converting usdc token to token with address ${tokenAddress} ...`);
    let tokenPairRate = await getUsdcToTokenRate(ethersProvider, tokenAddress);
    let result = applyRateToAmount(tokenPairRate, BigNumber.from(amount), Boolean(invert));

    console.log(`Rate usdc token to token: ${tokenPairRate.rate.toString()}`);
    if (invert) {
      console.log(
        `${ethersUtils.formatUnits(amount, tokenPairRate.tokenOutDecimals)} token is ${ethersUtils.formatUnits(
          result,
          tokenPairRate.tokenInDecimals
        )} usdc token`
      );
    } else {
      console.log(
        `${ethersUtils.formatUnits(amount, tokenPairRate.tokenInDecimals)} usdc token is ${ethersUtils.formatUnits(
          result,
          tokenPairRate.tokenOutDecimals
        )} token`
      );
    }
  },
} as CommandModule;
