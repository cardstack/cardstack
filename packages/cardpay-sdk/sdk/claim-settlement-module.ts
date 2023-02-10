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
  constructor(ethersProvider: JsonRpcProvider, signer?: Signer) {
    super(ethersProvider, signer);
    this.salt = 'cardstack-cs-create-safe';
    this.abi = ClaimSettlementABI;
  }

  async execute(): Promise<any> {
    // let { onTxnHash, nonce } = txnOptions ?? {};
    // const moduleAddress = await getAddress('claimSettlementModule', this.ethersProvider);
    // let module = new Contract(moduleAddress, ClaimSettlemntABI, this.ethersProvider);
    // let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    // let signerAddress = await signer.getAddress();
    // //signing here
    // const eip712Sign = await signTypedData(this.ethersProvider, signerAddress, {});
    // const { v, r, s } = await ethSignSignatureToRSVForSafe(eip712Sign);
    // const data = module.interface.encodeFunctionData('signedExecute(uint8,bytes32,bytes32,bytes,bytes', [v, r, s]);
  }
}

// const signMessage = async (message: string, signer: SignerWithAddress) => {
//   const abiCoder = new ethers.utils.AbiCoder();
//   const messageHashString = utils.keccak256(message);
//   const messageHashBytes = utils.arrayify(messageHashString);
//   const signature = await signer.signMessage(messageHashBytes);
//   const r = signature.slice(0, 66);
//   const s = '0x' + signature.slice(66, 130);
//   const v = parseInt(signature.slice(130, 132), 16);
//   const encodedSignature = abiCoder.encode(['uint8', 'bytes32', 'bytes32'], [v, r, s]);
//   return {
//     signature,
//     encodedSignature,
//     r,
//     s,
//     v,
//     messageHashBytes,
//     messageHashString,
//   };
// };
