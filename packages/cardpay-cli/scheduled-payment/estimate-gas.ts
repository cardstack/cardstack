import { Argv } from 'yargs';
import { GAS_ESTIMATION_SCENARIOS, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { fromWei } from 'web3-utils';

export default {
  command: 'estimate-gas <scenario>',
  describe: `Gas estimates for various scenarios in scheduled payments. This command allows you to estimate gas without sufficient transfer of tokens and gas tokens.`,
  builder(yargs: Argv) {
    return yargs
      .positional('scenario', {
        type: 'string',
        description: `Gas estimation scenario, values = ${GAS_ESTIMATION_SCENARIOS}`,
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, scenario } = args as unknown as {
      network: string;
      scenario: string;
    };

    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);

    console.log(`Estimate gas for ${scenario} scenario ...`);

    let result = await scheduledPaymentModule.estimateGas(scenario as typeof GAS_ESTIMATION_SCENARIOS[number], {});

    console.log(`Required gas: ${result.gas}`);
    console.log(`Required gas in ETH (slow): ${fromWei(result.gasRangeInWei.slow.toString(), 'ether')}`);
    console.log(`Required gas in ETH (standard): ${fromWei(result.gasRangeInWei.standard.toString(), 'ether')}`);
    console.log(`Required gas in ETH (fast): ${fromWei(result.gasRangeInWei.fast.toString(), 'ether')}`);
    console.log(`Required gas in USD (slow): ${fromWei(result.gasRangeInUSD.slow.toString(), 'ether')}`);
    console.log(`Required gas in USD (standard): ${fromWei(result.gasRangeInUSD.standard.toString(), 'ether')}`);
    console.log(`Required gas in USD (fast): ${fromWei(result.gasRangeInUSD.fast.toString(), 'ether')}`);
  },
} as CommandModule;
