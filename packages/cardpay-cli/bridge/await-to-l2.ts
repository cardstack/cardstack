import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'await-to-l2 <fromBlock> [recipient]',
  describe: 'Wait for token bridging from L1 to L2 to complete',
  builder(yargs: Argv) {
    return yargs
      .positional('fromBlock', {
        type: 'string',
        description: 'Layer 2 block height before bridging was initiated',
      })
      .positional('recipient', {
        type: 'string',
        description: 'Layer 2 address that is the owner of the bridged tokens, defaults to wallet address',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, fromBlock, recipient, trezor } = args as unknown as {
      network: string;
      mnemonic: string;
      fromBlock: string;
      recipient?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
    recipient = recipient ?? (await web3.eth.getAccounts())[0];

    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Waiting for bridging to complete for depot owner ${recipient} from block ${fromBlock}...`);
    let result = await tokenBridge.waitForBridgingToLayer2Completed(recipient, fromBlock);
    console.log(`Bridging transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  },
} as CommandModule;
