import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { Proof, getSDK, WithSymbol } from '@cardstack/cardpay-sdk';
import groupBy from 'lodash/groupBy';
import { fromWei } from 'web3-utils';

export default {
  command: 'claimable-proofs <address>',
  describe: 'View proofs that are claimable',
  builder(yargs: Argv) {
    return yargs
      .positional('address', {
        type: 'string',
        description: 'The address that tally rewarded -- The owner of prepaid card.',
      })
      .option('safeAddress', {
        type: 'string',
        description: 'safe address. Specify if you want gas estimates for each claim',
      })
      .option('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
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
      safeAddress?: string;
      rewardProgramId?: string;
      tokenAddress?: string;
      isValidOnly?: boolean;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let rewardPool = await getSDK('RewardPool', web3);
    let proofs;
    if (safeAddress) {
      proofs = await rewardPool.getProofs(address, safeAddress, rewardProgramId, tokenAddress, false);
    } else {
      proofs = await rewardPool.getProofs(address, undefined, rewardProgramId, tokenAddress, false);
    }
    if (isValidOnly) {
      displayProofs(proofs.filter((o) => o.isValid));
    } else {
      displayProofs(proofs);
    }
  },
} as CommandModule;

function displayProofs(proofs: WithSymbol<Proof>[]): void {
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
      displayProof(o);
    });
  });
}

function displayProof(o: WithSymbol<Proof>) {
  let gasAmount = o.gasEstimate?.amount;
  console.log(`
      proof: ${fromProofArray(o.proofArray)}
      leaf: ${o.leaf}
      balance: ${fromWei(o.amount)} ${o.tokenSymbol}
      token: ${o.tokenAddress} (${o.tokenSymbol})
      isValid: ${o.isValid} 
      gasFees: ${gasAmount ? fromWei(gasAmount) + ' ' + o.tokenSymbol : 'No Gas Estimates'}
        `);
}

const fromProofArray = (arr: string[]): string => {
  return (
    '0x' +
    arr.reduce((proof, s) => {
      return proof.concat(s.replace('0x', ''));
    }, '')
  );
};
