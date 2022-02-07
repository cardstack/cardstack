import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_ANY } from '../utils';
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
    let { network, mnemonic, token } = args as unknown as {
      network: string;
      token: string;
      mnemonic?: string;
    };
    if (token.toUpperCase() === 'ETH') {
      await layer1PriceOracleUpdatedAt(network, mnemonic);
    } else {
      await layer2PriceOracleUpdatedAt(network, token, mnemonic);
    }
  },
} as CommandModule;

export async function layer1PriceOracleUpdatedAt(network: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let layerOneOracle = await getSDK('LayerOneOracle', web3);
  let date = await layerOneOracle.getEthToUsdUpdatedAt();
  console.log(`The ETH / USD rate was last updated at ${date.toString()}`);
}

export async function layer2PriceOracleUpdatedAt(network: string, token: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
  let date = await layerTwoOracle.getUpdatedAt(token);
  console.log(`The ${token} rate was last updated at ${date.toString()}`);
}
