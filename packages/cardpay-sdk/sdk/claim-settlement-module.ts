/*global fetch */

import JsonRpcProvider from '../providers/json-rpc-provider';
import SafeModule from './safe-module';
import { Signer } from 'ethers';
import ClaimSettlementABI from '../contracts/abi/modules/claim-settlement-module';
// import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
// import { getAddress } from '../contracts/addresses';

// import ClaimSettlemntABI from '../contracts/abi/modules/claim-settlement-module';
// import { ethSignSignatureToRSVForSafe, signTypedData } from './utils/signing-utils';

export default class ClaimSettlementModule extends SafeModule {
  salt = 'cardstack-cs-create-safe';
  abi = ClaimSettlementABI;
  constructor(ethersProvider: JsonRpcProvider, signer?: Signer) {
    super(ethersProvider, signer);
  }
}
