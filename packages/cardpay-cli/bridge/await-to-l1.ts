import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'await-to-l1 <fromBlock> <txnHash>',
  describe: 'Wait for token bridging from L2 to L1 to complete validation',
  builder(yargs: Argv) {
    return yargs
      .positional('fromBlock', {
        type: 'string',
        description: 'Layer 2 block height before bridging was initiated',
      })
      .positional('txnHash', {
        type: 'string',
        description: 'Layer 2 transaction hash of the bridging transaction',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, fromBlock, txnHash } = args as unknown as {
      network: string;
      fromBlock: string;
      txnHash: string;
    };

    let web3 = await getWeb3(network, getWeb3Opts(args));
    let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);

    console.log(`Waiting for bridge validation to complete for ${txnHash}...`);

    let { messageId, encodedData, signatures } = await tokenBridge.waitForBridgingValidation(fromBlock, txnHash);
    console.log(`Bridge validation complete:
          messageId: ${messageId}
          encodedData: ${encodedData}
          signatures: ${signatures.join(' ')}
          `);
  },
} as CommandModule;
