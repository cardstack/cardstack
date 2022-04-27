import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { fromProof } from './utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
const { fromWei } = Web3.utils;

export default {
  command: 'claim-reward-gas-estimate <rewardSafe> <leaf> <proof> [acceptPartialClaim]',
  describe: 'Obtain a gas estimate to claim rewards to a reward safe',
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
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let proofArray = fromProof(proof);
    let assets = await getSDK('Assets', web3);
    let { gasToken, amount } = await rewardPool.claimGasEstimate(rewardSafe, leaf, proofArray, acceptPartialClaim);
    let { symbol } = await assets.getTokenInfo(gasToken);
    console.log(`The gas estimate for claiming reward to reward safe ${rewardSafe} is ${fromWei(amount)} ${symbol}`);
  },
} as CommandModule;
