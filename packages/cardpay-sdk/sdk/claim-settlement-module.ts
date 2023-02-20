import JsonRpcProvider from '../providers/json-rpc-provider';
import SafeModule from './safe-module';
import { Contract, Signer } from 'ethers';
import ClaimSettlementABI from '../contracts/abi/modules/claim-settlement-module';
import { SetupArgs } from './utils/module-utils';
import { Claim } from './claim-settlement/utils';
import ERC20ABI from '../contracts/abi/erc-20';
import { executeTransaction, gasEstimate, getNextNonceFromEstimate, Operation } from './utils/safe-utils';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
import { TransactionOptions, waitUntilTransactionMined } from './utils/general-utils';
import { ContractOptions } from 'web3-eth-contract';
import { signSafeTx } from './utils/signing-utils';
import { AddressZero } from '@ethersproject/constants';

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

  async addValidator(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async addValidator(
    moduleAddress: string,
    safeAddress: string,
    validatorAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async addValidator(
    moduleAddress: string,
    safeAddress?: string,
    validatorAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    //TODO: Multi-signature. Only supports adding single validator only
    if (!safeAddress) {
      throw new Error('safeAddress must be specified');
    }
    if (!validatorAddress) {
      throw new Error('validatorAddress must be specified');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    let data = await module.interface.encodeFunctionData('addValidator', [validatorAddress]);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      module.address,
      '0',
      data,
      Operation.CALL,
      AddressZero,
      true
    );

    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }

    let gnosisTxn = await executeTransaction(
      this.ethersProvider,
      safeAddress,
      module.address,
      data,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.ethersProvider,
        safeAddress,
        module.address,
        data,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.signer
      )
    );

    let txnHash = gnosisTxn.ethereumTx.txHash;
    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return await waitUntilTransactionMined(this.ethersProvider, txnHash);
  }
}
