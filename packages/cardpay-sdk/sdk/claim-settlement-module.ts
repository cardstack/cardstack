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
/* eslint-disable node/no-extraneous-import */
import { AddressZero } from '@ethersproject/constants';
import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import AccountRegistrationABI from '../contracts/abi/account-registration-nft';
import { getAddress } from '../contracts/addresses';

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
  async isValidator(moduleAddress: string, possibleValidator: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.isValidator(possibleValidator);
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
    avatarAddress: string,
    validatorAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async addValidator(
    moduleAddress: string,
    avatarAddress?: string,
    validatorAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    //TODO: Multi-signature. Only supports adding single validator only
    if (!avatarAddress) {
      throw new Error('avatarAddress must be specified');
    }
    if (!validatorAddress) {
      throw new Error('validatorAddress must be specified');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    let data = await module.interface.encodeFunctionData('addValidator', [validatorAddress]);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let safe = new Contract(avatarAddress, GnosisSafeABI, this.ethersProvider);
    const safeOwners = await safe.getOwners();
    if (!safeOwners.contain(signer)) {
      throw new Error(`${signer} is not owner of avatar ${avatarAddress}`);
    }

    let estimate = await gasEstimate(
      this.ethersProvider,
      avatarAddress,
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
      avatarAddress,
      module.address,
      data,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.ethersProvider,
        avatarAddress,
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
    let tokenAddress = await getAddress('cardToken', this.ethersProvider);
    let transferAmount = BigNumber.from(utils.parseUnits('1', 'ether'));
    return new Claim(
      id,
      (await this.ethersProvider.getNetwork()).chainId.toString(),
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
  }

  async executeEOA(moduleAddress: string, txnOptions?: TransactionOptions): Promise<SuccessfulTransactionReceipt> {
    let { onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);

    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let callerAddress = await signer.getAddress();
    let claim = await this.defaultClaim(moduleAddress, callerAddress);
    let minTokens = BigNumber.from(utils.parseUnits('0.1', 'ether'));
    let signature = await claim.sign(signer as VoidSigner);
    let encoded = claim.abiEncode(['uint256'], [minTokens]);
    let data = module.interface.encodeFunctionData('signedExecute', [signature, encoded]);
    await module.callStatic.signedExecute(signature, encoded, { from: callerAddress });
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
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async executeSafe(
    moduleAddressOrTxnHash: string,
    payeeSafeAddress?: string,
    gasTokenAddress?: string,
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
    let signature = await claim.sign(signer as VoidSigner);
    let minTokens = BigNumber.from(utils.parseUnits('0.1', 'ether'));
    let encoded = claim.abiEncode(['uint256'], [minTokens]);
    let data = await module.interface.encodeFunctionData('signedExecute', [signature, encoded]);
    await module.callStatic.signedExecute(signature, encoded, { from: payeeSafeAddress });

    let estimate = await gasEstimate(
      this.ethersProvider,
      payeeSafeAddress,
      module.address,
      '0',
      data,
      Operation.CALL,
      gasTokenAddress ?? AddressZero,
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

  async registerAccount(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async registerAccount(
    safeAddress: string,
    recipient?: string,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async registerAccount(
    safeAddressOrTxnHash: string,
    recipient?: string,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    //TODO: Multi-signature. Only supports adding single validator only
    let safeAddress = safeAddressOrTxnHash;
    if (!safeAddress) {
      throw new Error('safeAddress must be specified');
    }
    let accountRegistrationAddress = await getAddress('accountRegistrationNft', this.ethersProvider);

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let accountRegistration = new Contract(accountRegistrationAddress, AccountRegistrationABI, this.ethersProvider);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    await accountRegistration.callStatic.register(safeAddress, recipient ?? safeAddress, { from: safeAddress });
    let data = await accountRegistration.interface.encodeFunctionData('register', [
      safeAddress,
      recipient ?? safeAddress,
    ]);

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      accountRegistrationAddress,
      '0',
      data,
      Operation.CALL,
      gasTokenAddress ?? AddressZero,
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
      accountRegistrationAddress,
      data,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.ethersProvider,
        safeAddress,
        accountRegistrationAddress,
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

  async tokenIds(ownerAddress: string) {
    let accountRegistrationAddress = await getAddress('accountRegistrationNft', this.ethersProvider);
    let accountRegistration = new Contract(accountRegistrationAddress, AccountRegistrationABI, this.ethersProvider);
    let count = (await accountRegistration.balanceOf(ownerAddress)).toNumber();
    let promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(accountRegistration.tokenOfOwnerByIndex(ownerAddress, i));
    }
    let tokenIds = (await Promise.all(promises)).map((o) => o.toHexString());
    return tokenIds;
  }
}
