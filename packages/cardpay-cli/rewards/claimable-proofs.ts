import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
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
      .option('rewardProgramId', {
        type: 'string',
        description: 'The reward program id.',
      })
      .option('tokenAddress', {
        type: 'string',
        description: 'The address of the tokens that are being claimed as rewards',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, address, rewardProgramId, tokenAddress } = args as unknown as {
      network: string;
      address: string;
      rewardProgramId?: string;
      tokenAddress?: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let rewardPool = await getSDK('RewardPool', web3);
    const proofs = await rewardPool.getProofs(address, rewardProgramId, tokenAddress, false);
    displayProofs(proofs);
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
      console.log(`
      proof: ${fromProofArray(o.proofArray)}
      leaf: ${o.leaf}
      balance: ${fromWei(o.amount)} ${o.tokenSymbol}
      token: ${o.tokenAddress} (${o.tokenSymbol})
        `);
    });
  });
}

const fromProofArray = (arr: string[]): string => {
  return (
    '0x' +
    arr.reduce((proof, s) => {
      return proof.concat(s.replace('0x', ''));
    }, '')
  );
};
