import JsonRpcProvider from '../providers/json-rpc-provider';
import SafeModule from './safe-module';
import { BigNumber, Contract, Signer, VoidSigner, utils } from 'ethers';
import ClaimSettlementABI from '../contracts/abi/modules/claim-settlement-module';
import { SetupArgs } from './utils/module-utils';
import { NFTOwner, Claim, TimeRangeSeconds, TransferERC20ToCaller } from './claim-settlement/utils';
import ERC20ABI from '../contracts/abi/erc-20';
import { executeTransaction, gasEstimate, getNextNonceFromEstimate, Operation } from './utils/safe-utils';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
import { TransactionOptions, waitUntilTransactionMined, resolveDoc } from './utils/general-utils';
import { ContractOptions } from 'web3-eth-contract';
import { signSafeTx } from './utils/signing-utils';
/* eslint-disable node/no-extraneous-import */
import { AddressZero } from '@ethersproject/constants';
import AccountRegistrationABI from '../contracts/abi/account-registration-nft';

import { getAddress } from '../contracts/addresses';

/**
 * @group Champer
 * @category Rewards
 * @alpha
 */
export interface SignedClaim {
  signature: string;
  encoded: string;
}

/**
 * @group Champer
 * @category Rewards
 * @alpha
 */
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

  async getValidators(moduleAddress: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.getValidators();
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

  async removeValidator(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async removeValidator(
    moduleAddress: string,
    avatarAddress: string,
    validatorAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async removeValidator(
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
    let data = await module.interface.encodeFunctionData('removeValidator', [validatorAddress]);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

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

  async defaultStakingClaim(moduleAddress: string, payeeAddress?: string): Promise<Claim> {
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let callerAddress = await signer.getAddress();
    let tokenAddress = await getAddress('cardToken', this.ethersProvider);
    let nftAddress = await getAddress('accountRegistrationNft', this.ethersProvider); // by default using our NFT
    return this.stakingClaim(moduleAddress, payeeAddress ?? callerAddress, tokenAddress, '1', nftAddress);
  }

  async stakingClaim(
    moduleAddress: string,
    payeeAddress: string,
    tokenAddress: string,
    amountInEth: string,
    nftAddress: string,
    validitySeconds = 86400
  ): Promise<Claim> {
    let id = utils.hexlify(utils.randomBytes(32));
    let startBlockNum = await this.ethersProvider.getBlockNumber();
    let startBlockTime = (await this.ethersProvider.getBlock(startBlockNum)).timestamp;
    let transferAmount = BigNumber.from(utils.parseUnits(amountInEth, 'ether'));
    return new Claim(
      id,
      (await this.ethersProvider.getNetwork()).chainId.toString(),
      moduleAddress,
      new TimeRangeSeconds(startBlockTime, startBlockTime + validitySeconds),
      new NFTOwner(nftAddress, BigNumber.from(payeeAddress)),
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

  async executeEOA(
    moduleAddress: string,
    signedClaim: SignedClaim,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt> {
    let { onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let callerAddress = await signer.getAddress();
    let { signature, encoded } = signedClaim;
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
    signedClaim: SignedClaim,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async executeSafe(
    moduleAddressOrTxnHash: string,
    payeeSafeAddress?: string,
    signedClaim?: SignedClaim,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    //TODO: Multi-signature. Only supports adding single validator only
    let moduleAddress = moduleAddressOrTxnHash;
    if (!moduleAddress) {
      throw new Error('moduleAddress must be specified');
    }
    if (!payeeSafeAddress) {
      throw new Error('payeeSafeAddress must be specified');
    }
    if (!signedClaim) {
      throw new Error('signedClaim must be specified');
    }

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());
    let { signature, encoded } = signedClaim;
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

  async getDid(moduleAddress: string) {
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    return module.configuration();
  }

  async getConfiguration(moduleAddress: string) {
    let did = await this.getDid(moduleAddress);
    return resolveDoc(did);
  }

  async setDid(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async setDid(
    moduleAddress: string,
    safeAddress: string,
    did: string,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async setDid(
    moduleAddressOrTxnHash: string,
    safeAddress?: string,
    did?: string,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    let moduleAddress = moduleAddressOrTxnHash;
    if (!moduleAddress) {
      throw new Error('moduleAddress must be specified');
    }
    if (!did) {
      throw new Error('did must be specified');
    }
    if (!safeAddress) {
      throw new Error('safeAddress must be specified');
    }

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());
    let data = await module.interface.encodeFunctionData('setConfiguration', [did]);
    await module.callStatic.setConfiguration(did, { from: safeAddress });

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
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

  async sign(claim: Claim): Promise<SignedClaim> {
    let encoded = claim.abiEncode();
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let signature = await claim.sign(signer as VoidSigner);
    return {
      signature,
      encoded,
    };
  }
}
