import JsonRpcProvider from '../providers/json-rpc-provider';
import SafeModule from './safe-module';
import { Contract, Signer } from 'ethers';
import ClaimSettlementABI from '../contracts/abi/modules/claim-settlement-module';
import { SetupArgs } from './utils/module-utils';
import { Claim } from './claim-settlement/utils';
import { ERC20ABI } from '..';

export default class ClaimSettlementModule extends SafeModule {
  safeSalt = 'cardstack-cs-create-safe';
  moduleSalt = 'cardstack-cs-deploy-module';
  abi = ClaimSettlementABI;
  constructor(ethersProvider: JsonRpcProvider, signer?: Signer) {
    super(ethersProvider, signer);
  }
  setupArgs(safeAddress: string): SetupArgs {
    return {
      types: ['address', 'address', 'address'],
      values: [safeAddress, safeAddress, safeAddress],
    };
  }
  async isValidator(moduleAddress: string, possibleValidator?: string) {
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.isValidator(possibleValidator ?? signer);
  }

  async isValidState(claim: Claim, moduleAddress: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.isValidState(claim.stateCheck.typeHash(), claim.stateCheck.abiEncode());
  }

  async isValidCaller(claim: Claim, moduleAddress: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.isValidCaller(claim.callerCheck.typeHash(), claim.callerCheck.abiEncode());
  }

  async isUsed(claim: Claim, moduleAddress: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.used(claim.id);
  }

  async hasBalance(claim: Claim, safeAddress: string) {
    const action = claim.action.asMapping();
    if (action.structName == 'TransferERC20ToCaller') {
      let token = new Contract(action.token, ERC20ABI, this.ethersProvider);
      let balance = await token.callStatic.balanceOf(safeAddress);
      if (balance.gt(action.amount)) {
        throw new Error('not enough balance');
      }
    } else if (action.structName == 'TransferNFTToCaller') {
      //TODO
    } else {
      throw new Error('action not implemented');
    }
  }
}
