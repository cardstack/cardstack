import { Argv } from 'yargs';
import { getUsdcToTokenRate } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { applyRateToAmount } from '@cardstack/cardpay-sdk';
import { BigNumber, utils as ethersUtils } from 'ethers';

export default {
  command: 'usd-to-token <tokenAddress> <amount> <invert>',
  describe: 'Convert usd token to any token',
  builder(yargs: Argv) {
    return yargs
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of scheduled payment module',
      })
      .positional('amount', {
        type: 'string',
        description:
          'If invert false, the value of usd token. Else, the value of token (in the smallest units of token)',
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

    console.log(`Converting usd token to token with address ${tokenAddress} ...`);
    let tokenPairRate = await getUsdcToTokenRate(ethersProvider, tokenAddress);
    let result = applyRateToAmount(tokenPairRate, BigNumber.from(amount), Boolean(invert));

    console.log(`Rate usd token to token: ${tokenPairRate.rate.toString()}`);
    console.log(
      `${ethersUtils.parseUnits(amount, tokenPairRate.tokenInDecimals)} usd token to token: ${ethersUtils.formatUnits(
        result.toString(),
        invert ? tokenPairRate.tokenInDecimals : tokenPairRate.tokenOutDecimals
      )}`
    );
  },
} as CommandModule;
