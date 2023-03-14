import { Argv } from 'yargs';
import { getNativeToTokenRate } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { applyRateToAmount } from '@cardstack/cardpay-sdk';
import { BigNumber, utils as ethersUtils } from 'ethers';

export default {
  command: 'native-to-token <tokenAddress> <amount> <invert>',
  describe: 'Convert native token to any token',
  builder(yargs: Argv) {
    return yargs
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of scheduled payment module',
      })
      .positional('amount', {
        type: 'string',
        description:
          'If invert false, the value of native token. Else, the value of token (in the smallest units of token)',
      })
      .positional('invert', {
        type: 'string',
        description: 'Invert the conversion',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, tokenAddress, amount, invert } = args as unknown as {
      network: string;
      tokenAddress: string;
      amount: string;
      invert: string;
    };
    let { ethersProvider } = await getEthereumClients(network, getConnectionType(args));
    console.log(invert);
    console.log(`Converting native token to token with address ${tokenAddress} ...`);
    let tokenPairRate = await getNativeToTokenRate(ethersProvider, tokenAddress);
    let result = applyRateToAmount(tokenPairRate, BigNumber.from(amount), Boolean(invert));
    console.log(result.toString());
    console.log(`Rate native token to token: ${tokenPairRate.rate.toString()}`);
    console.log(
      `${ethersUtils.formatUnits(
        amount,
        tokenPairRate.tokenInDecimals
      )} native token to token: ${ethersUtils.formatUnits(
        result.toString(),
        invert ? tokenPairRate.tokenInDecimals : tokenPairRate.tokenOutDecimals
      )}`
    );
  },
} as CommandModule;
