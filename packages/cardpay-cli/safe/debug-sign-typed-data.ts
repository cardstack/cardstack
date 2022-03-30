import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { signTypedData } from '@cardstack/cardpay-sdk';

export default {
  command: 'debug-sign-typed-data [data] [address]',
  describe: 'Perform a typed data signature on the provided typed data',
  builder(yargs: Argv) {
    return yargs
      .positional('data', {
        type: 'string',
        description: 'The typed data to sign (as a JSON string)',
      })
      .positional('address', {
        type: 'string',
        description: '(optional) The address of the signer, defaults to the first HD derived path for the seed',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let {
      network,
      data: dataStr,
      address,
    } = args as unknown as {
      network: string;
      data: string;
      address?: string;
    };
    let data = JSON.parse(dataStr);
    let web3 = await getWeb3(network, getWeb3Opts(args));
    address = address ?? (await web3.eth.getAccounts())[0];
    console.log(`Signing typed data for address ${address}:
    ${JSON.stringify(data, null, 2)}
    `);

    let signature = await signTypedData(web3, address, data);
    console.log(`Signature for the typed data is: ${signature}`);
  },
} as CommandModule;
