import JsonRpcProvider from '../providers/json-rpc-provider';
import SafeModule from './safe-module';
import { Signer } from 'ethers';
import ClaimSettlementABI from '../contracts/abi/modules/claim-settlement-module';
import { SetupArgs } from './utils/module-utils';

export default class ClaimSettlementModule extends SafeModule {
  salt = 'cardstack-cs-create-safe';
  abi = ClaimSettlementABI;
  constructor(ethersProvider: JsonRpcProvider, signer?: Signer) {
    super(ethersProvider, signer);
  }
  async setupArgs(safeAddress: string): Promise<SetupArgs> {
    return {
      types: ['address', 'address', 'address'],
      values: [safeAddress, safeAddress, safeAddress],
    };
  }
}
