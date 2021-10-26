import Web3 from 'web3';
import RewardManagerABI from '../../contracts/abi/v0.8.4/reward-manager';
import { Contract } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem, randomHex, toChecksumAddress } from 'web3-utils';

export default class RewardManager {
  private rewardManager: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

  async getRewardProgramRegistrationFees(): Promise<number> {
    return Number(await (await this.getRewardManager()).methods.rewardProgramRegistrationFeeInSPEND().call());
  }

  async getRewardeeRegistrationFees(): Promise<number> {
    return Number(await (await this.getRewardManager()).methods.rewardeeRegistrationFeeInSPEND().call());
  }

  async isRewardProgram(rewardProgramId: string): Promise<boolean> {
    return (await this.getRewardManager()).methods.isRewardProgram(rewardProgramId).call();
  }

  async newRewardProgramId(): Promise<string> {
    let rewardProgramIdExists: boolean;
    let rewardProgramId: string;
    do {
      rewardProgramId = toChecksumAddress(randomHex(20));
      rewardProgramIdExists = await this.isRewardProgram(rewardProgramId);
    } while (rewardProgramIdExists);
    return rewardProgramId;
  }

  async getRewardSafeOwner(rewardSafeAddress: string): Promise<string> {
    return await (await this.getRewardManager()).methods.getRewardSafeOwner(rewardSafeAddress).call();
  }

  private async getRewardManager(): Promise<Contract> {
    if (this.rewardManager) {
      return this.rewardManager;
    }
    this.rewardManager = new this.layer2Web3.eth.Contract(
      RewardManagerABI as AbiItem[],
      await getAddress('rewardManager', this.layer2Web3)
    );
    return this.rewardManager;
  }
}
