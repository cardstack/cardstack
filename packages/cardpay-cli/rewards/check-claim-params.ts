import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { fromProof } from './utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { fromWei } from 'web3-utils';

export default {
  command: 'check-claim-params <rewardSafe> <leaf> <proof> [acceptPartialClaim]',
  describe: 'Checks claim parameters. You can use this for gasEstimate errors or claim errors',
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
    let rewardManager = await getSDK('RewardManager', web3);
    let proofArray = fromProof(proof);
    let { rewardProgramId, token, amount, paymentCycleNumber, tokenType, validFrom, validTo, payee } =
      rewardPool.decodeLeaf(leaf);

    let isValidSafe = await rewardManager.isValidRewardSafe(rewardSafe, rewardProgramId);
    let isRewardProgram = await rewardManager.isRewardProgram(rewardProgramId);
    let isClaimed = await rewardPool.isClaimed(leaf);
    let isValid = await rewardPool.isValid(leaf, proofArray);
    if (!amount || !token) {
      throw new Error('tokenType is not supported');
    }
    let assets = await getSDK('Assets', web3);
    let { symbol } = await assets.getTokenInfo(token);
    let sufficientBalanceInPool = await rewardPool.sufficientBalanceInPool(
      rewardProgramId,
      amount,
      token,
      acceptPartialClaim
    );
    console.log(`
    == DECODED LEAF ==

    Reward Program ID:         ${rewardProgramId}
    Payment Cycle:             ${paymentCycleNumber}
    Valid From:                ${validFrom}
    Valid To:                  ${validTo}
    Token type:                ${tokenType}
    Token:                     ${token} 
    Amount:                    ${fromWei(amount)} ${symbol}
    Payee/Rewardee:            ${payee}
    `);

    console.log(`
    == CLAIM PARAMS CHECK ==

    Reward Program Valid:       ${isRewardProgram}
    Reward Safe Valid:          ${isValidSafe}
    Proof Unclaimed:            ${!isClaimed}
    Proof Valid:                ${isValid}
    Sufficient Balance in pool: ${sufficientBalanceInPool}

    ALL THE ABOVE MUST BE TRUE
    `);
  },
} as CommandModule;
