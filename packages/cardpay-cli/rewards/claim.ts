import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK, getConstant } from '@cardstack/cardpay-sdk';

export default {
  command: 'claim <rewardSafe> <leaf> <proof> [acceptPartialClaim]',
  describe: 'Claim rewards using proof',
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
    let web3 = await getWeb3(network, getWeb3Opts(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let proofArray = fromProof(proof);
    await rewardPool.claim(rewardSafe, leaf, proofArray, acceptPartialClaim, {
      onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log(`Claimed reward to safe ${rewardSafe}`);
  },
} as CommandModule;

const fromProof = (proof: string): any => {
  if (proof == '0x') {
    return [];
  }
  let bytesSize = 32;
  let hexChunkSize = bytesSize * 2;
  let hexStr = proof.replace('0x', '');
  if (hexStr.length % hexChunkSize != 0) {
    throw new Error('proof array is wrong size');
  }
  return chunkString(hexStr, hexChunkSize).map((s) => '0x' + s);
};

function chunkString(str: string, chunkSize: number) {
  let arr = str.match(new RegExp('.{1,' + chunkSize + '}', 'g'));
  if (arr) {
    return arr;
  } else {
    throw new Error('proof cannot be converted to proof array  split properly');
  }
}
