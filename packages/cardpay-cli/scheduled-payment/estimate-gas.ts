import { Argv } from 'yargs';
import { GasEstimationScenario, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { fromWei } from 'web3-utils';

export default {
  command: 'estimate-gas <scenario> <tokenAddress> <gasTokenAddress>',
  describe: `Gas estimates for various scenarios in scheduled payments. This command allows you to estimate gas without sufficient transfer of tokens and gas tokens.`,
  builder(yargs: Argv) {
    return yargs
      .positional('scenario', {
        type: 'string',
        description: `Gas estimation scenario, values = ${Object.values(GasEstimationScenario).join(', ')}`,
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
    let { network, scenario, tokenAddress, gasTokenAddress } = args as unknown as {
      network: string;
      scenario: string;
      tokenAddress: string | null;
      gasTokenAddress: string | null;
    };

    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);

    console.log(`Estimate gas for ${scenario} scenario ...`);

    let result = await scheduledPaymentModule.estimateGas(
      scenario as GasEstimationScenario,
      tokenAddress,
      gasTokenAddress
    );

    console.log(`Required gas: ${result.gas}`);
    console.log(`Required gas in eth (slow): ${fromWei(result.gasRangeInWei.slow.toString(), 'ether')}`);
    console.log(`Required gas in eth (standard): ${fromWei(result.gasRangeInWei.standard.toString(), 'ether')}`);
    console.log(`Required gas in eth (fast): ${fromWei(result.gasRangeInWei.fast.toString(), 'ether')}`);
  },
} as CommandModule;
