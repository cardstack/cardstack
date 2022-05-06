import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, NETWORK_OPTION_LAYER_1, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'claim-on-l1 <messageId> <encodedData> <signatures..>',
  describe: 'Claim tokens that have been bridged from L2 to L1',
  builder(yargs: Argv) {
    return yargs
      .positional('messageId', {
        type: 'string',
        description: 'The message id for the bridging (obtained from `cardpay bridge await-to-l1`)',
      })
      .positional('encodedData', {
        type: 'string',
        description: 'The encoded data for the bridging (obtained from `cardpay bridge await-to-l1`)',
      })
      .positional('signatures', {
        type: 'string',
        description:
          'The bridge validator signatures received from bridging (obtained from `cardpay bridge await-to-l1`)',
      })
      .options({
        network: NETWORK_OPTION_LAYER_1,
      });
  },
  async handler(args: Arguments) {
    let { network, messageId, encodedData, signatures } = args as unknown as {
      network: string;
      messageId: string;
      encodedData: string;
      signatures: string[];
    };

    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Claiming layer 1 bridge tokens for message ID ${messageId}...`);
    await tokenBridge.claimBridgedTokens(messageId, encodedData, signatures, {
      onTxnHash: (txnHash) => console.log(`transaction hash: ${blockExplorer}/tx/${txnHash}`),
    });
    console.log('Completed');
  },
} as CommandModule;
