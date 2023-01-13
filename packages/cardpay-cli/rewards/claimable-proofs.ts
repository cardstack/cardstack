import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { Proof, getSDK, WithSymbol, ClaimableProof, RewardPool } from '@cardstack/cardpay-sdk';
import groupBy from 'lodash/groupBy';
import { fromWei } from 'web3-utils';

export default {
  command: 'claimable-proofs <address> <rewardProgramId>',
  describe: 'View proofs that are claimable',
  builder(yargs: Argv) {
    return yargs
      .positional('address', {
        type: 'string',
        description: 'The address that tally rewarded -- The owner of prepaid card.',
      })
      .positional('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('safeAddress', {
        type: 'string',
        description: 'safe address. Specify if you want gas estimates for each claim',
      })
      .option('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as rewards',
      })
      .option('isValidOnly', {
        type: 'boolean',
        description: 'Filter proofs which are valid, i.e. validFrom <= currentBlock < validTo',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, address, rewardProgramId, tokenAddress, isValidOnly, safeAddress } = args as unknown as {
      network: string;
      address: string;
      rewardProgramId: string;
      safeAddress?: string;
      tokenAddress?: string;
      isValidOnly?: boolean;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let proofs;
    if (safeAddress) {
      proofs = await rewardPool.getProofs(address, rewardProgramId, safeAddress, tokenAddress, false);
    } else {
      proofs = await rewardPool.getProofs(address, rewardProgramId, undefined, tokenAddress, false);
    }
    if (isValidOnly) {
      displayProofs(
        proofs.filter((o) => o.isValid),
        rewardPool
      );
    } else {
      displayProofs(proofs, rewardPool);
    }
  },
} as CommandModule;

function displayProofs(proofs: WithSymbol<Proof | ClaimableProof>[], rewardPool: RewardPool): void {
  if (proofs.length == 0) {
    console.log(`
    No proofs to display
    `);
  }
  const groupedByRewardProgram = groupBy(proofs, (a) => a.rewardProgramId);
  Object.keys(groupedByRewardProgram).map((rewardProgramId: string) => {
    console.log(`---------------------------------------------------------------------
  RewardProgram: ${rewardProgramId}
---------------------------------------------------------------------`);
    let p = groupedByRewardProgram[rewardProgramId];
    p.map((o) => {
      logProof(o, rewardPool);
    });
  });
}

function logProof(o: WithSymbol<Proof> | WithSymbol<ClaimableProof>, rewardPool: RewardPool) {
  console.log(`
      proof: ${fromProofBytes(o.proofBytes)}
      leaf: ${o.leaf}
      balance: ${fromWei(o.amount)} ${o.tokenSymbol}
      token: ${o.tokenAddress} (${o.tokenSymbol})
      isValid: ${o.isValid} 
      gasFees: ${
        rewardPool.isClaimableProof(o) ? fromWei(o.gasEstimate.amount) + ' ' + o.tokenSymbol : 'No Gas Estimates'
      }
      explanationTemplate: ${o.explanationTemplate ?? 'Not specified'} 
      explanationData: 
        ${JSON.stringify(o.explanationData, null, 4) ?? 'Not specified'} 
      parsedExplanation: ${o.parsedExplanation ?? 'Explanation missing'} 
        `);
}

const fromProofBytes = (arr: string[]): string => {
  //proofBytes is an array of hex encoded strings
  return (
    '0x' +
    arr.reduce((proof, s) => {
      return proof.concat(s.replace('0x', ''));
    }, '')
  );
};
