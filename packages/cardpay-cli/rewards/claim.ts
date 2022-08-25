import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { fromProof } from './utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK, getConstant } from '@cardstack/cardpay-sdk';

export default {
  command: 'claim <rewardSafe> <leaf> <proof> [acceptPartialClaim]',
  describe: 'Claim reward using proof',
  builder(yargs: Argv) {
    return yargs
      .positional('rewardSafe', {
        type: 'string',
        description: 'The address of the rewardSafe which will receive the rewards',
      })
      .positional('leaf', {
        type: 'string',
        description: 'The encoded the encoded bytes of merkle tree',
      })
      .positional('proof', {
        type: 'string',
        description: 'The proof used to claim reward',
      })
      .option('acceptPartialClaim', {
        type: 'boolean',
        description: 'Boolean if user is fine to accept partial claim of reward',
        default: false,
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, rewardSafe, leaf, proof, acceptPartialClaim } = args as unknown as {
      network: string;
      rewardSafe: string;
      leaf: string;
      proof: string;
      acceptPartialClaim: boolean;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let proofArray = fromProof(proof);
    await rewardPool.claim(rewardSafe, leaf, proofArray, acceptPartialClaim, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Claimed reward to safe ${rewardSafe}`);
  },
} as CommandModule;
