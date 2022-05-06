import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_ANY, getConnectionType, Web3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'updated-at <token>',
  describe: 'Get the date that the oracle was last updated for the specified token',
  builder(yargs: Argv) {
    return yargs
      .positional('token', {
        type: 'string',
        description: 'The token symbol (without the .CPXD suffix)',
      })
      .options({
        network: NETWORK_OPTION_ANY,
      });
  },
  async handler(args: Arguments) {
    let { network, token } = args as unknown as {
      network: string;
      token: string;
    };
    let web3Opts = getConnectionType(args);
    if (token.toUpperCase() === 'ETH') {
      await layer1PriceOracleUpdatedAt(network, web3Opts);
    } else {
      await layer2PriceOracleUpdatedAt(network, token, web3Opts);
    }
  },
} as CommandModule;

export async function layer1PriceOracleUpdatedAt(network: string, web3Opts: Web3Opts): Promise<void> {
  let { web3 } = await getEthereumClients(network, web3Opts);
  let layerOneOracle = await getSDK('LayerOneOracle', web3);
  let date = await layerOneOracle.getEthToUsdUpdatedAt();
  console.log(`The ETH / USD rate was last updated at ${date.toString()}`);
}

export async function layer2PriceOracleUpdatedAt(network: string, token: string, web3Opts: Web3Opts): Promise<void> {
  let { web3 } = await getEthereumClients(network, web3Opts);
  let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
  let date = await layerTwoOracle.getUpdatedAt(token);
  console.log(`The ${token} rate was last updated at ${date.toString()}`);
}
