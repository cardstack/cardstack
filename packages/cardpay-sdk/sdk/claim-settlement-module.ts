import JsonRpcProvider from '../providers/json-rpc-provider';
import SafeModule from './safe-module';
import { BigNumber, Contract, Signer, VoidSigner, utils } from 'ethers';
import ClaimSettlementABI from '../contracts/abi/modules/claim-settlement-module';
import { SetupArgs } from './utils/module-utils';
import { Address, Claim, TimeRangeSeconds, TransferERC20ToCaller } from './claim-settlement/utils';
import ERC20ABI from '../contracts/abi/erc-20';
import { executeTransaction, gasEstimate, getNextNonceFromEstimate, Operation } from './utils/safe-utils';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
import { TransactionOptions, waitUntilTransactionMined } from './utils/general-utils';
import { ContractOptions } from 'web3-eth-contract';
import { signSafeTx } from './utils/signing-utils';
import { AddressZero } from '@ethersproject/constants';
// import { getAddress } from '../contracts/addresses';

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

  async isValidCaller(claim: Claim, moduleAddress: string, caller: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.isValidCaller(caller, claim.callerCheck.typeHash(), claim.callerCheck.abiEncode());
  }

  async isUsed(claim: Claim, moduleAddress: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.used(claim.id);
  }

  async hasBalance(claim: Claim, moduleAddress: string): Promise<any> {
    let { avatar: avatarAddress } = await this.getDetails(moduleAddress);
    let action = claim.action.asMapping();
    if (claim.action.structName == 'TransferERC20ToCaller') {
      let token = new Contract(action.token, ERC20ABI, this.ethersProvider);
      let balance = await token.callStatic.balanceOf(avatarAddress);
      if (balance.lt(action.amount)) {
        return false;
      }
    } else if (claim.action.structName == 'TransferNFTToCaller') {
      return false;
    } else {
      return false;
    }
    return true;
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

  async defaultClaim(moduleAddress: string, payeeAddress: string) {
    let id = utils.hexlify(utils.randomBytes(32));
    let startBlockNum = await this.ethersProvider.getBlockNumber();
    let startBlockTime = (await this.ethersProvider.getBlock(startBlockNum)).timestamp;
    let validitySeconds = 86400; //1 day
    let tokenAddress = '0x95093b8836ED53B4594EC748995E45b0Cd2b1389'; // CTST goerli
    let transferAmount = BigNumber.from(utils.parseUnits('1', 'ether'));
    return new Claim(
      id,
      this.ethersProvider.network.chainId.toString(),
      moduleAddress,
      new TimeRangeSeconds(startBlockTime, startBlockTime + validitySeconds),
      new Address(payeeAddress),
      new TransferERC20ToCaller(tokenAddress, transferAmount)
    );
  }

  async checkValidity(claim: Claim, moduleAddress: string, callerAddress: string): Promise<void> {
    if (await this.isUsed(claim, moduleAddress)) {
      throw new Error(`Root is used`);
    }
    if (!(await this.isValidCaller(claim, moduleAddress, callerAddress))) {
      throw new Error(`Caller not valid`);
    }
    if (!(await this.isValidState(claim, moduleAddress))) {
      throw new Error(`State not valid`);
    }
    if (!(await this.hasBalance(claim, moduleAddress))) {
      throw new Error(`Not enough balance`);
    }
    if (!(await this.isValidator(moduleAddress, callerAddress))) {
      throw new Error(`Signer ${callerAddress} is not a validator`);
    }
  }

  async executeEOA(moduleAddress: string, txnOptions?: TransactionOptions): Promise<SuccessfulTransactionReceipt> {
    let { onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);

    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let callerAddress = await signer.getAddress();
    let claim = await this.defaultClaim(moduleAddress, callerAddress);

    await this.checkValidity(claim, moduleAddress, callerAddress);

    let transferAmount = BigNumber.from(utils.parseUnits('1', 'ether'));

    let signature = await claim.sign(signer as VoidSigner);
    let encoded = claim.abiEncode(['uint256'], [transferAmount]);
    let data = module.interface.encodeFunctionData('signedExecute', [signature, encoded]);
    let response = await signer.sendTransaction({
      to: moduleAddress,
      data: data,
    });
    if (typeof onTxnHash === 'function') {
      await onTxnHash(response.hash);
    }
    return waitUntilTransactionMined(this.ethersProvider, response.hash);
  }

  async executeSafe(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async executeSafe(
    moduleAddress: string,
    payeeSafeAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async executeSafe(
    moduleAddressOrTxnHash: string,
    payeeSafeAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    //TODO: Multi-signature. Only supports adding single validator only
    let moduleAddress = moduleAddressOrTxnHash;
    if (!payeeSafeAddress) {
      throw new Error('payeeSafeAddress must be specified');
    }

    if (!moduleAddress) {
      throw new Error('moduleAddress must be specified');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());
    let claim = await this.defaultClaim(moduleAddress, payeeSafeAddress);

    await this.checkValidity(claim, moduleAddress, payeeSafeAddress);
    let signature = await claim.sign(signer as VoidSigner);
    let transferAmount = BigNumber.from(utils.parseUnits('1', 'ether'));
    let encoded = claim.abiEncode(['uint256'], [transferAmount]);
    let data = await module.interface.encodeFunctionData('signedExecute', [signature, encoded]);

    let estimate = await gasEstimate(
      this.ethersProvider,
      payeeSafeAddress,
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
      payeeSafeAddress,
      module.address,
      data,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.ethersProvider,
        payeeSafeAddress,
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
