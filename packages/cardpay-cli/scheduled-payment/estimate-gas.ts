import { Argv } from 'yargs';
import { GAS_ESTIMATION_SCENARIOS, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { fromWei } from 'web3-utils';

export default {
  command: 'estimate-gas <scenario> <safeAddress> <tokenAddress> <gasTokenAddress>',
  describe: `Gas estimates for various scenarios in scheduled payments. This command allows you to estimate gas without sufficient transfer of tokens and gas tokens.`,
  builder(yargs: Argv) {
    return yargs
      .positional('scenario', {
        type: 'string',
        description: `Gas estimation scenario, values = ${GAS_ESTIMATION_SCENARIOS}`,
      })
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of safe with SP module enabled',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the token being transferred',
      })
      .positional('gasTokenAddress', {
        type: 'string',
        description: 'The address of the gas token',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, scenario, safeAddress, tokenAddress, gasTokenAddress } = args as unknown as {
      network: string;
      scenario: string;
      safeAddress: string | null;
      tokenAddress: string | null;
      gasTokenAddress: string | null;
    };

    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);

    console.log(`Estimate gas for ${scenario} scenario ...`);

    let result = await scheduledPaymentModule.estimateGas(scenario as typeof GAS_ESTIMATION_SCENARIOS[number], {
      safeAddress,
      tokenAddress,
      gasTokenAddress,
    });

    console.log(`Required gas: ${result.gas}`);
    console.log(`Required gas in ETH (slow): ${fromWei(result.gasRangeInWei.slow.toString(), 'ether')}`);
    console.log(`Required gas in ETH (standard): ${fromWei(result.gasRangeInWei.standard.toString(), 'ether')}`);
    console.log(`Required gas in ETH (fast): ${fromWei(result.gasRangeInWei.fast.toString(), 'ether')}`);
    console.log(`Required gas in USD (slow): ${fromWei(result.gasRangeInUSD.slow.toString(), 'ether')}`);
    console.log(`Required gas in USD (standard): ${fromWei(result.gasRangeInUSD.standard.toString(), 'ether')}`);
    console.log(`Required gas in USD (fast): ${fromWei(result.gasRangeInUSD.fast.toString(), 'ether')}`);
  },
} as CommandModule;
