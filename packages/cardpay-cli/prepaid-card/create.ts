import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { ContractOptions } from 'web3-eth-contract';

export default {
  command: 'create <safeAddress> <tokenAddress> <customizationDID> <faceValues..>',
  describe: 'Create prepaid cards using the specified token from the specified safe with the amounts provided',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose funds to use to create the prepaid cards',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The token address (defaults to Kovan DAI)',
      })
      .positional('customizationDID', {
        type: 'string',
        description: 'The DID string that represents the prepaid card customization',
      })
      .positional('faceValues', {
        type: 'number',
        description: 'A list of face values (separated by spaces) in units of § SPEND to create',
      })
      .option('force', {
        type: 'boolean',
        description: 'Force the prepaid card to be created even when the DAI rate is not snapped to USD',
        default: false,
      })
      .option('from', {
        type: 'string',
        description: 'The signing EOA. Defaults to the first derived EOA of the specified mnemonic',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, tokenAddress, customizationDID, force, faceValues, from } = args as unknown as {
      network: string;
      safeAddress: string;
      faceValues: number[];
      tokenAddress: string;
      force: boolean;
      customizationDID?: string;
      from?: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));

    let prepaidCard = await getSDK('PrepaidCard', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(tokenAddress);

    console.log(
      `Creating prepaid card(s) with face value(s) §${faceValues.join(
        ' SPEND, §'
      )} SPEND and issuing token ${symbol} from depot ${safeAddress}${
        force ? '. Forcing creation even when DAI not snapped to USD rate' : ''
      }...`
    );
    let onTxnHash = (txnHash: string) =>
      console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`);
    let contractOptions = {} as ContractOptions;
    if (from) {
      contractOptions.from = from;
    }
    let {
      prepaidCards: [newCard],
    } = await prepaidCard.create(
      safeAddress,
      tokenAddress,
      faceValues,
      undefined,
      customizationDID,
      { onTxnHash },
      contractOptions,
      force
    );
    console.log(`created card ${newCard.address}`);
    console.log('done');
  },
} as CommandModule;
