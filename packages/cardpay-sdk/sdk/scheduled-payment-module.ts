/*global fetch */

import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import ScheduledPaymentABI from '../contracts/abi/modules/scheduled-payment-module';
import ScheduledPaymentConfigABI from '../contracts/abi/modules/scheduled-payment-config';
import { getAddress } from '../contracts/addresses';
import { isAddress, toWei } from 'web3-utils';
import {
  deployAndSetUpModule,
  encodeMultiSend,
  encodeMultiSendCallOnly,
  getModuleProxyCreationEvent,
} from './utils/module-utils';
import {
  extractBytesLikeFromError,
  extractSendTransactionErrorMessage,
  generateSaltNonce,
  hubRequest,
  isTransactionHash,
  Transaction,
  TransactionOptions,
  waitUntilTransactionMined,
} from './utils/general-utils';

import { ContractOptions } from 'web3-eth-contract';
import {
  Estimate,
  executeTransaction,
  gasEstimate,
  generateCreate2SafeTx,
  getNextNonceFromEstimate,
  getSafeProxyCreationEvent,
  Operation,
} from './utils/safe-utils';
import { BigNumber, Contract, Signer, utils } from 'ethers';
import { signSafeTx, signSafeTxAsBytes, Signature } from './utils/signing-utils';
import { convertChainIdToName, ERC20ABI, getSDK } from '..';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
/* eslint-disable node/no-extraneous-import */
import { AddressZero } from '@ethersproject/constants';
import {
  GasEstimationScenario,
  waitUntilCancelPaymentTransactionMined,
  waitUntilSchedulePaymentTransactionMined,
} from './scheduled-payment/utils';
import BN from 'bn.js';
import { Interface } from 'ethers/lib/utils';
import JsonRpcProvider from '../providers/json-rpc-provider';
import { getConstant, getConstantByNetwork } from './constants';
import { getGasPricesInNativeWei, getNativeWeiInToken } from './utils/conversions';

export interface EnableModuleAndGuardResult {
  scheduledPaymentModuleAddress: string;
  metaGuardAddress: string;
}

export interface CreateSafeWithModuleAndGuardResult {
  safeAddress: string;
  scheduledPaymentModuleAddress: string;
  metaGuardAddress: string;
}

export interface CreateSafeWithModuleAndGuardTx {
  multiSendCallOnlyTx: Transaction;
  expectedSafeAddress: string;
  expectedSPModuleAddress: string;
  expectedMetaGuardAddress: string;
}

type GasRange = Record<'slow' | 'standard' | 'fast', BigNumber>;
export interface GasEstimationResult {
  gas: BigNumber;
  gasRangeInWei: GasRange;
  gasRangeInUSD: GasRange;
}

interface TransactionParams {
  nonce: BN;
  estimate: Estimate;
  payload: any;
  signature: Signature;
}

export interface SchedulePaymentProgressListener {
  onBeginHubAuthentication?: () => unknown;
  onEndHubAuthentication?: () => unknown;
  onBeginSpHashCreation?: () => unknown;
  onEndSpHashCreation?: () => unknown;
  onBeginPrepareScheduledPayment?: () => unknown;
  onEndPrepareScheduledPayment?: () => unknown;
  onBeginRegisterPaymentWithHub?: () => unknown;
  onScheduledPaymentIdReady?: (scheduledPaymentId: string) => unknown;
  onEndRegisterPaymentWithHub?: () => unknown;
  onBeginSchedulingPaymentOnChain?: () => unknown;
  onTxHash?: (txHash: string) => unknown;
  onEndSchedulingPaymentOnChain?: () => unknown;
  onBeginUpdatingHubWithTxHash?: () => unknown;
  onEndUpdatingHubWithTxHash?: () => unknown;
  onBeginWaitingForTransactionConfirmation?: () => unknown;
  onEndWaitingForTransactionConfirmation?: () => unknown;
  onBeginRemovePaymentFromHub?: () => unknown;
  onEndRemovePaymentFromHub?: () => unknown;
}

interface SchedulePaymentOptions {
  hubUrl?: string;
  listener?: SchedulePaymentProgressListener;
}

export default class ScheduledPaymentModule {
  constructor(private ethersProvider: JsonRpcProvider, private signer?: Signer) {
    this.signer = signer ? signer.connect(ethersProvider) : signer;
  }

  async enableModuleAndGuard(txnHash: string): Promise<EnableModuleAndGuardResult>;
  async enableModuleAndGuard(
    safeAddress: string,
    gasTokenAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<EnableModuleAndGuardResult>;
  async enableModuleAndGuard(
    safeAddressOrTxnHash: string,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<EnableModuleAndGuardResult> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      return this.getModuleAndGuardAddressFromTxn(safeAddressOrTxnHash);
    }

    let safeAddress = safeAddressOrTxnHash;
    if (!safeAddress) {
      throw new Error('safeAddress must be specified');
    }
    if (!gasTokenAddress) {
      throw new Error('gasTokenAddress must be specified');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let enableModuleTxs = await this.generateEnableModuleTxs(safeAddress);
    let setGuardTxs = await this.generateSetGuardTxs(safeAddress);

    let multiSendTransaction = await encodeMultiSend(this.ethersProvider, [...enableModuleTxs.txs, ...setGuardTxs.txs]);

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.value,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      gasTokenAddress,
      true
    );
    let gasCost = BigNumber.from(estimate.safeTxGas)
      .add(BigNumber.from(estimate.baseGas))
      .mul(BigNumber.from(estimate.gasPrice));

    let token = new Contract(gasTokenAddress, ERC20ABI, this.ethersProvider);
    let symbol = await token.symbol();
    let balance = await token.callStatic.balanceOf(safeAddress);
    let decimals = await token.callStatic.decimals();
    if (balance.lt(gasCost)) {
      throw new Error(
        `Safe does not have enough balance to enable scheduled payment module. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${utils.formatUnits(
          balance,
          decimals
        )}, the the gas cost is ${utils.formatUnits(gasCost, decimals)} ${symbol}`
      );
    }
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let gnosisTxn = await executeTransaction(
      this.ethersProvider,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      estimate,
      nonce,
      await signSafeTx(
        this.ethersProvider,
        safeAddress,
        multiSendTransaction.to,
        multiSendTransaction.data,
        multiSendTransaction.operation,
        estimate,
        nonce,
        from,
        this.signer
      )
    );

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }

    return {
      scheduledPaymentModuleAddress: enableModuleTxs.expectedModuleAddress,
      metaGuardAddress: setGuardTxs.expectedModuleAddress,
    };
  }

  async createSafeWithModuleAndGuardTx(from: string): Promise<CreateSafeWithModuleAndGuardTx> {
    let { expectedSafeAddress, create2SafeTx } = await generateCreate2SafeTx(
      this.ethersProvider,
      [from],
      1,
      AddressZero,
      '0x',
      AddressZero,
      AddressZero,
      '0',
      AddressZero,
      generateSaltNonce('cardstack-sp-create-safe')
    );
    let enableModuleTxs = await this.generateEnableModuleTxs(expectedSafeAddress, [from]);
    let setGuardTxs = await this.generateSetGuardTxs(expectedSafeAddress);

    let multiSendTx = await encodeMultiSend(this.ethersProvider, [...enableModuleTxs.txs, ...setGuardTxs.txs]);
    let gnosisSafe = new Contract(expectedSafeAddress, GnosisSafeABI, this.ethersProvider);
    let estimate = await gasEstimate(
      this.ethersProvider,
      await getAddress('gnosisSafeMasterCopy', this.ethersProvider),
      multiSendTx.to,
      multiSendTx.value,
      multiSendTx.data,
      multiSendTx.operation,
      AddressZero,
      true
    );
    let nonce = new BN('0');
    let gasPrice = '0';
    let [signature] = await signSafeTxAsBytes(
      this.ethersProvider,
      multiSendTx.to,
      Number(multiSendTx.value),
      multiSendTx.data,
      multiSendTx.operation,
      estimate.safeTxGas,
      estimate.baseGas,
      gasPrice,
      estimate.gasToken,
      estimate.refundReceiver,
      nonce,
      from,
      gnosisSafe.address,
      this.signer
    );
    let safeTxData = gnosisSafe.interface.encodeFunctionData('execTransaction', [
      multiSendTx.to,
      Number(multiSendTx.value),
      multiSendTx.data,
      multiSendTx.operation,
      estimate.safeTxGas,
      estimate.baseGas,
      gasPrice,
      estimate.gasToken,
      estimate.refundReceiver,
      signature,
    ]);
    let safeTx: Transaction = {
      to: expectedSafeAddress,
      value: '0',
      data: safeTxData,
      operation: Operation.CALL,
    };
    let multiSendCallOnlyTx = await encodeMultiSendCallOnly(this.ethersProvider, [create2SafeTx, safeTx]);
    return {
      multiSendCallOnlyTx,
      expectedSafeAddress,
      expectedSPModuleAddress: enableModuleTxs.expectedModuleAddress,
      expectedMetaGuardAddress: setGuardTxs.expectedModuleAddress,
    };
  }

  async createSafeWithModuleAndGuardEstimation(contractOptions?: ContractOptions): Promise<BigNumber> {
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let { expectedSafeAddress, create2SafeTx } = await generateCreate2SafeTx(
      this.ethersProvider,
      [from],
      1,
      AddressZero,
      '0x',
      AddressZero,
      AddressZero,
      '0',
      AddressZero,
      generateSaltNonce('cardstack-sp-create-safe')
    );
    let enableModuleTxs = await this.generateEnableModuleTxs(expectedSafeAddress, [from]);
    let setGuardTxs = await this.generateSetGuardTxs(expectedSafeAddress);

    let createSafeGas = await this.ethersProvider.estimateGas({
      to: create2SafeTx.to,
      data: create2SafeTx.data,
    });
    let deploySPModuleGas = await this.ethersProvider.estimateGas({
      to: enableModuleTxs.txs[0].to,
      data: enableModuleTxs.txs[0].data,
    });
    let deployMetaGuardGas = await this.ethersProvider.estimateGas({
      to: setGuardTxs.txs[0].to,
      data: setGuardTxs.txs[0].data,
    });

    let estimateEnableSPModule = await gasEstimate(
      this.ethersProvider,
      await getAddress('gnosisSafeMasterCopy', this.ethersProvider),
      utils.getAddress(enableModuleTxs.txs[1].to),
      enableModuleTxs.txs[1].value,
      enableModuleTxs.txs[1].data,
      enableModuleTxs.txs[1].operation,
      AddressZero,
      true
    );
    let enableSPModuleGas = BigNumber.from(estimateEnableSPModule.baseGas).add(estimateEnableSPModule.safeTxGas);

    let estimateSetMetaGuard = await gasEstimate(
      this.ethersProvider,
      await getAddress('gnosisSafeMasterCopy', this.ethersProvider),
      utils.getAddress(enableModuleTxs.txs[1].to),
      setGuardTxs.txs[1].value,
      setGuardTxs.txs[1].data,
      setGuardTxs.txs[1].operation,
      AddressZero,
      true
    );
    let setMetaGuardGas = BigNumber.from(estimateSetMetaGuard.baseGas).add(estimateSetMetaGuard.safeTxGas);

    return createSafeGas.add(deploySPModuleGas).add(deployMetaGuardGas).add(enableSPModuleGas).add(setMetaGuardGas);
  }

  async createSafeWithModuleAndGuard(
    txnHash?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<CreateSafeWithModuleAndGuardResult> {
    if (txnHash && isTransactionHash(txnHash)) {
      let safeAddress = await this.getSafeAddressFromTxn(txnHash);
      let { scheduledPaymentModuleAddress, metaGuardAddress } = await this.getModuleAndGuardAddressFromTxn(txnHash);
      return {
        safeAddress,
        scheduledPaymentModuleAddress,
        metaGuardAddress,
      };
    }

    let { onTxnHash } = txnOptions ?? {};
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let { multiSendCallOnlyTx, expectedSafeAddress, expectedSPModuleAddress, expectedMetaGuardAddress } =
      await this.createSafeWithModuleAndGuardTx(from);
    let response = await signer.sendTransaction({
      to: multiSendCallOnlyTx.to,
      data: multiSendCallOnlyTx.data,
    });

    if (typeof onTxnHash === 'function') {
      await onTxnHash(response.hash);
    }

    return {
      safeAddress: expectedSafeAddress,
      scheduledPaymentModuleAddress: expectedSPModuleAddress,
      metaGuardAddress: expectedMetaGuardAddress,
    };
  }

  async generateEnableModuleTxs(safeAddress: string, safeOwners: string[] = []) {
    let masterCopy = new Contract(
      await getAddress('scheduledPaymentModule', this.ethersProvider),
      ScheduledPaymentABI,
      this.ethersProvider
    );
    let configAddress = await getAddress('scheduledPaymentConfig', this.ethersProvider);
    let exchangeAddress = await getAddress('scheduledPaymentExchange', this.ethersProvider);
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.ethersProvider, masterCopy, {
      types: ['address', 'address', 'address[]', 'address', 'address', 'address'],
      values: [safeAddress, safeAddress, safeOwners, safeAddress, configAddress, exchangeAddress],
    });
    let safe = new Contract(safeAddress, GnosisSafeABI, this.ethersProvider);
    let enableModuleData = safe.interface.encodeFunctionData('enableModule', [expectedModuleAddress]);
    let enableModuleTransaction = {
      data: enableModuleData,
      to: safeAddress,
      value: '0',
      operation: Operation.CALL,
    };

    return { txs: [transaction, enableModuleTransaction], expectedModuleAddress };
  }

  async generateSetGuardTxs(safeAddress: string) {
    let masterCopy = new Contract(
      await getAddress('metaGuard', this.ethersProvider),
      MetaGuardABI,
      this.ethersProvider
    );
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.ethersProvider, masterCopy, {
      types: ['address', 'address', 'uint256', 'address[]'],
      values: [safeAddress, safeAddress, 0, []],
    });
    let safe = new Contract(safeAddress, GnosisSafeABI, this.ethersProvider);
    let setGuardData = safe.interface.encodeFunctionData('setGuard', [expectedModuleAddress]);
    let setGuardTransaction = {
      data: setGuardData,
      to: safeAddress,
      value: '0',
      operation: Operation.CALL,
    };

    return { txs: [transaction, setGuardTransaction], expectedModuleAddress };
  }

  async getSafeAddressFromTxn(txnHash: string): Promise<string> {
    let receipt = await waitUntilTransactionMined(this.ethersProvider, txnHash);
    let params = await getSafeProxyCreationEvent(this.ethersProvider, receipt.logs);
    return params[0].args.proxy;
  }

  async getModuleAndGuardAddressFromTxn(txnHash: string): Promise<EnableModuleAndGuardResult> {
    let receipt = await waitUntilTransactionMined(this.ethersProvider, txnHash);
    let moduleProxyCreationEvents = await getModuleProxyCreationEvent(this.ethersProvider, receipt.logs);
    let scheduledPaymentMasterCopy = await getAddress('scheduledPaymentModule', this.ethersProvider);
    let metaGuardMasterCopy = await getAddress('metaGuard', this.ethersProvider);
    let scheduledPaymentModuleAddress = moduleProxyCreationEvents.find(
      (event) => event.args['masterCopy'] === scheduledPaymentMasterCopy
    )?.args['proxy'];
    let metaGuardAddress = moduleProxyCreationEvents.find((event) => event.args['masterCopy'] === metaGuardMasterCopy)
      ?.args['proxy'];
    return {
      scheduledPaymentModuleAddress,
      metaGuardAddress,
    };
  }

  async estimateExecutionGas(
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    gasPrice: string,
    payAt?: number | null,
    recurringDayOfMonth?: number | null,
    recurringUntil?: number | null,
    feeFixedUSD?: number | null,
    feePercentage?: number | null
  ): Promise<number> {
    if (payAt == null && (recurringDayOfMonth == null || recurringUntil == null))
      throw new Error('When payAt is null, recurringDayOfMonth and recurringUntil must have a value');
    if (payAt != null && (recurringDayOfMonth != null || recurringUntil != null))
      throw new Error('When payAt is not null, recurringDayOfMonth and recurringUntil must be null');

    let getRequiredGasFromRevertMessage = function (e: any): number {
      let _interface = new utils.Interface(['error GasEstimation(uint256 gas)']);
      let hex = extractBytesLikeFromError(e);
      let decodedError = _interface.parseError(hex ?? '0x');
      return decodedError.args[0].toNumber();
    };

    feeFixedUSD =
      feeFixedUSD != null ? feeFixedUSD : (await getConstant('scheduledPaymentFeeFixedUSD', this.ethersProvider))!;
    feePercentage =
      feePercentage != null ? feePercentage : (await getConstant('scheduledPaymentFeeFixedUSD', this.ethersProvider))!;
    let requiredGas = 0;
    try {
      let module = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
      if (recurringDayOfMonth) {
        await module.estimateGas[
          'estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256,uint256)'
        ](
          tokenAddress,
          amount,
          payeeAddress,
          this.composeFees(feeFixedUSD, feePercentage),
          maxGasPrice,
          gasTokenAddress,
          salt,
          recurringDayOfMonth,
          recurringUntil,
          gasPrice
        );
      } else {
        await module.estimateGas[
          'estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256)'
        ](
          tokenAddress,
          amount,
          payeeAddress,
          this.composeFees(feeFixedUSD, feePercentage),
          maxGasPrice,
          gasTokenAddress,
          salt,
          payAt,
          gasPrice
        );
      }
    } catch (e: any) {
      requiredGas = getRequiredGasFromRevertMessage(e);
    }

    // Costs to route through the proxy and nested calls
    const PROXY_GAS = 1000;
    // https://github.com/ethereum/solidity/blob/dfe3193c7382c80f1814247a162663a97c3f5e67/libsolidity/codegen/ExpressionCompiler.cpp#L1764
    // This was `false` before solc 0.4.21 -> `m_context.evmVersion().canOverchargeGasForCall()`
    // So gas needed by caller will be around 35k
    const OLD_CALL_GAS = 35000;
    return requiredGas + PROXY_GAS + OLD_CALL_GAS;
  }

  async cancelScheduledPaymentOnChain(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async cancelScheduledPaymentOnChain(
    safeAddress: string,
    moduleAddress: string,
    spHash: string,
    gasTokenAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<void>;
  async cancelScheduledPaymentOnChain(
    safeAddressOrTxnHash: string,
    moduleAddress?: string,
    spHash?: string,
    gasTokenAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt | void> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitUntilTransactionMined(this.ethersProvider, txnHash);
    }

    if (!moduleAddress) {
      throw new Error('moduleAddress must be specified');
    }
    if (!spHash) {
      throw new Error('spHash must be specified');
    }
    if (!gasTokenAddress) {
      throw new Error('gasTokenAddress must be specified');
    }

    let safeAddress = safeAddressOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let scheduledPaymentModule = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    let spHashes = await scheduledPaymentModule.getSpHashes();
    if (!spHashes.includes(spHash)) {
      throw new Error(`unknown spHash`);
    }

    let cancelScheduledPaymentData = scheduledPaymentModule.interface.encodeFunctionData('cancelScheduledPayment', [
      spHash,
    ]);
    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      '0',
      cancelScheduledPaymentData,
      Operation.CALL,
      gasTokenAddress,
      true
    );
    let gasCost = BigNumber.from(estimate.safeTxGas)
      .add(BigNumber.from(estimate.baseGas))
      .mul(BigNumber.from(estimate.gasPrice));

    let token = new Contract(gasTokenAddress, ERC20ABI, this.ethersProvider);
    let symbol = await token.callStatic.symbol();
    let balance = await token.callStatic.balanceOf(safeAddress);
    let decimals = await token.callStatic.decimals();
    if (balance.lt(gasCost)) {
      throw new Error(
        `Safe does not have enough balance to cancel scheduled payment. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${utils.formatUnits(
          balance,
          decimals
        )}, the the gas cost is ${utils.formatUnits(gasCost, decimals)} ${symbol}`
      );
    }
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let gnosisTxn = await executeTransaction(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      cancelScheduledPaymentData,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.ethersProvider,
        safeAddress,
        moduleAddress,
        cancelScheduledPaymentData,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.signer
      )
    );

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
  }

  async createSpHash(
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    payAt?: number | null,
    recurringDayOfMonth?: number | null,
    recurringUntil?: number | null
  ): Promise<string> {
    if (payAt == null && (recurringDayOfMonth == null || recurringUntil == null))
      throw new Error('When payAt is null, recurringDayOfMonth and recurringUntil must have a value');
    if (payAt != null && (recurringDayOfMonth != null || recurringUntil != null))
      throw new Error('When payAt is not null, recurringDayOfMonth and recurringUntil must be null');

    let spHash;
    let module = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    let feeFixedUSD = (await getConstant('scheduledPaymentFeeFixedUSD', this.ethersProvider))!;
    let feePercentage = (await getConstant('scheduledPaymentFeePercentage', this.ethersProvider))!;
    if (recurringUntil) {
      spHash = await module.callStatic[
        'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)'
      ](
        tokenAddress,
        amount,
        payeeAddress,
        this.composeFees(feeFixedUSD, feePercentage),
        executionGas,
        maxGasPrice,
        gasTokenAddress,
        salt,
        recurringDayOfMonth,
        recurringUntil
      );
    } else {
      spHash = await module.callStatic[
        'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)'
      ](
        tokenAddress,
        amount,
        payeeAddress,
        this.composeFees(feeFixedUSD, feePercentage),
        executionGas,
        maxGasPrice,
        gasTokenAddress,
        salt,
        payAt
      );
    }

    return spHash;
  }

  private async generateSchedulePaymentTxParams(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string
  ) {
    let contract = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    let payload = contract.interface.encodeFunctionData('schedulePayment', [spHash]);

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      '0',
      payload,
      Operation.CALL,
      gasTokenAddress,
      true
    );

    let nonce = getNextNonceFromEstimate(estimate);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = await signer.getAddress();

    let signature = (
      await signSafeTx(
        this.ethersProvider,
        safeAddress,
        moduleAddress,
        payload,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.signer
      )
    )[0];

    return { nonce, estimate, payload, signature };
  }

  private async generateCancelPaymentTxParams(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string
  ) {
    let contract = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    let payload = contract.interface.encodeFunctionData('cancelScheduledPayment', [spHash]);

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      '0',
      payload,
      Operation.CALL,
      gasTokenAddress,
      true
    );

    let nonce = getNextNonceFromEstimate(estimate);
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = await signer.getAddress();

    let signature = (
      await signSafeTx(
        this.ethersProvider,
        safeAddress,
        moduleAddress,
        payload,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.signer
      )
    )[0];

    return { nonce, estimate, payload, signature };
  }

  private async schedulePaymentOnChainAndUpdateCrank(
    hubRootUrl: string,
    authToken: string,
    scheduledPaymentId: string,
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string,
    txnParams: TransactionParams,
    listener?: SchedulePaymentProgressListener
  ) {
    return new Promise<void>((resolve, reject) => {
      listener?.onBeginSchedulingPaymentOnChain?.();
      this.schedulePaymentOnChain(safeAddress, moduleAddress, gasTokenAddress, spHash, txnParams, {
        onTxnHash: async (txHash: string) => {
          listener?.onTxHash?.(txHash);
          listener?.onEndSchedulingPaymentOnChain?.();
          listener?.onBeginUpdatingHubWithTxHash?.();
          await hubRequest(hubRootUrl, `api/scheduled-payments/${scheduledPaymentId}`, authToken, 'PATCH', {
            data: {
              attributes: {
                'creation-transaction-hash': txHash,
              },
            },
          });
          listener?.onEndUpdatingHubWithTxHash?.();
          resolve();
        },
      }).catch(reject);
    });
  }

  private async cancelPaymentOnChainAndUpdateCrank(
    hubRootUrl: string,
    authToken: string,
    scheduledPaymentId: string,
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string,
    txnParams: TransactionParams
  ) {
    return new Promise<void>((resolve, reject) => {
      this.cancelPaymentOnChain(safeAddress, moduleAddress, gasTokenAddress, spHash, txnParams, {
        onTxnHash: async (txHash: string) => {
          await hubRequest(hubRootUrl, `api/scheduled-payments/${scheduledPaymentId}`, authToken, 'PATCH', {
            data: {
              attributes: {
                'cancelation-transaction-hash': txHash,
              },
            },
          });
          resolve();
        },
      }).catch(reject);
    });
  }

  async cancelScheduledPayment(scheduledPaymentId: string, hubRootUrl?: string, authToken?: string) {
    let hubAuth = await getSDK('HubAuth', this.ethersProvider, hubRootUrl, this.signer);
    hubRootUrl = await hubAuth.getHubUrl();
    if (!authToken) {
      authToken = await hubAuth.authenticate();
    }

    let scheduledPaymentResponse = await hubRequest(
      hubRootUrl,
      `api/scheduled-payments/${scheduledPaymentId}`,
      authToken,
      'GET'
    );

    let scheduledPayment = scheduledPaymentResponse.data.attributes;
    let safeAddress = scheduledPayment['sender-safe-address'];
    let moduleAddress = scheduledPayment['module-address'];
    let cancelationBlockNumber = scheduledPayment['cancelation-block-number'];
    let cancelationTransactionHash = scheduledPayment['cancelation-transaction-hash'];
    let gasTokenAddress = scheduledPayment['gas-token-address'];
    let spHash = scheduledPayment['sp-hash'];

    if (cancelationBlockNumber) {
      return true; // Already canceled and transaction mined
    } else if (cancelationTransactionHash) {
      return await waitUntilCancelPaymentTransactionMined(hubRootUrl, scheduledPaymentId, authToken);
    }

    let txnParams = await this.generateCancelPaymentTxParams(safeAddress, moduleAddress, gasTokenAddress, spHash);

    await this.cancelPaymentOnChainAndUpdateCrank(
      hubRootUrl,
      authToken,
      scheduledPaymentId,
      safeAddress,
      moduleAddress,
      gasTokenAddress,
      spHash,
      txnParams
    );

    await waitUntilCancelPaymentTransactionMined(hubRootUrl, scheduledPaymentId, authToken);
  }

  async schedulePaymentOnChain(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async schedulePaymentOnChain(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string,
    txnParams?: TransactionParams,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async schedulePaymentOnChain(
    safeAddressOrTxnHash: string,
    moduleAddress?: string,
    gasTokenAddress?: string,
    spHash?: string,
    txnParams?: TransactionParams,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt> {
    let { onTxnHash } = txnOptions ?? {};

    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitUntilTransactionMined(this.ethersProvider, txnHash);
    }

    let safeAddress = safeAddressOrTxnHash;

    if (!safeAddress) {
      throw new Error('safeAddress must be provided');
    }
    if (!moduleAddress) {
      throw new Error('moduleAddress must be provided');
    }
    if (!gasTokenAddress) {
      throw new Error('gasTokenAddress must be provided');
    }
    if (!spHash) {
      throw new Error('spHash must be provided');
    }

    let nonce, estimate, payload, signature;

    if (txnParams && Object.keys(txnParams).length > 0) {
      ({ nonce, estimate, payload, signature } = txnParams);
    } else {
      ({ nonce, estimate, payload, signature } = await this.generateSchedulePaymentTxParams(
        safeAddress,
        moduleAddress,
        gasTokenAddress,
        spHash
      ));
    }

    let gnosisTxn = await executeTransaction(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      [signature]
    );

    let txnHash = gnosisTxn.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return await waitUntilTransactionMined(this.ethersProvider, txnHash);
  }

  async schedulePayment(scheduledPaymentId: string): Promise<void>;
  async schedulePayment(
    safeAddress: string,
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    payAt?: number | null,
    recurringDayOfMonth?: number | null,
    recurringUntil?: number | null,
    options?: SchedulePaymentOptions | null
  ): Promise<void>;
  async schedulePayment(
    safeAddressOrScheduledPaymentId: string,
    moduleAddress?: string,
    tokenAddress?: string,
    amount?: string,
    payeeAddress?: string,
    executionGas?: number,
    maxGasPrice?: string,
    gasTokenAddress?: string,
    salt?: string,
    payAt?: number | null,
    recurringDayOfMonth?: number | null,
    recurringUntil?: number | null,
    options: SchedulePaymentOptions = {}
  ) {
    options.listener?.onBeginHubAuthentication?.();
    let hubAuth = await getSDK('HubAuth', this.ethersProvider, options.hubUrl, this.signer);
    let hubRootUrl = await hubAuth.getHubUrl();
    let authToken = await hubAuth.authenticate();
    options.listener?.onEndHubAuthentication?.();

    let safeAddress: string;

    if (isAddress(safeAddressOrScheduledPaymentId)) {
      safeAddress = safeAddressOrScheduledPaymentId;
    } else {
      let scheduledPaymentId = safeAddressOrScheduledPaymentId;

      return await waitUntilSchedulePaymentTransactionMined(
        hubRootUrl,
        scheduledPaymentId,
        authToken,
        options.listener
      );
    }

    if (!moduleAddress) throw new Error('moduleAddress must be provided');
    if (!tokenAddress) throw new Error('tokenAddress must be provided ');
    if (!amount) throw new Error('amount must be provided');
    if (!payeeAddress) throw new Error('payeeAddress must be provided');
    if (!executionGas) throw new Error('executionGas must be provided');
    if (!maxGasPrice) throw new Error('maxGasPrice must be provided');
    if (!gasTokenAddress) throw new Error('gasTokenAddress must be provided ');
    if (!salt) throw new Error('salt must be provided');

    options.listener?.onBeginSpHashCreation?.();
    let spHash: string = await this.createSpHash(
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      executionGas,
      maxGasPrice,
      gasTokenAddress,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil
    );
    options.listener?.onEndSpHashCreation?.();

    let txnParams = await this.generateSchedulePaymentTxParams(safeAddress, moduleAddress, gasTokenAddress, spHash);

    options.listener?.onBeginPrepareScheduledPayment?.();
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let account = await signer.getAddress();
    let feeFixedUSD = (await getConstant('scheduledPaymentFeeFixedUSD', this.ethersProvider))!;
    let feePercentage = (await getConstant('scheduledPaymentFeePercentage', this.ethersProvider))!;
    options.listener?.onEndPrepareScheduledPayment?.();

    options.listener?.onBeginRegisterPaymentWithHub?.();
    let scheduledPaymentResponse = await hubRequest(hubRootUrl, 'api/scheduled-payments', authToken, 'POST', {
      data: {
        attributes: {
          'sender-safe-address': safeAddress,
          'module-address': moduleAddress,
          'token-address': tokenAddress,
          'gas-token-address': gasTokenAddress,
          amount,
          'payee-address': payeeAddress,
          'execution-gas-estimation': executionGas,
          'max-gas-price': maxGasPrice,
          'fee-fixed-usd': feeFixedUSD,
          'fee-percentage': feePercentage,
          salt,
          'pay-at': payAt,
          'sp-hash': spHash,
          'chain-id': this.ethersProvider.network.chainId,
          'user-address': account,
          'recurring-day-of-month': recurringDayOfMonth,
          'recurring-until': recurringUntil,
        },
      },
    });

    let scheduledPaymentId = scheduledPaymentResponse.data.id;
    options.listener?.onScheduledPaymentIdReady?.(scheduledPaymentId);
    options.listener?.onEndRegisterPaymentWithHub?.();

    try {
      await this.schedulePaymentOnChainAndUpdateCrank(
        hubRootUrl,
        authToken,
        scheduledPaymentId,
        safeAddress,
        moduleAddress,
        gasTokenAddress,
        spHash,
        txnParams,
        options.listener
      );
    } catch (error) {
      console.log(
        `Error while submitting the transaction to register the scheduled payment on the blockchain: ${error}`
      );

      options.listener?.onBeginRemovePaymentFromHub?.();
      await hubRequest(hubRootUrl, `api/scheduled-payments/${scheduledPaymentId}`, authToken, 'DELETE');
      options.listener?.onEndRemovePaymentFromHub?.();

      console.log(`Scheduled payment removed from the crank.`);

      throw error;
    }

    await waitUntilSchedulePaymentTransactionMined(hubRootUrl, scheduledPaymentId, authToken, options.listener);
  }

  async cancelPaymentOnChain(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async cancelPaymentOnChain(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string,
    txnParams?: TransactionParams,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async cancelPaymentOnChain(
    safeAddressOrTxnHash: string,
    moduleAddress?: string,
    gasTokenAddress?: string,
    spHash?: string,
    txnParams?: TransactionParams,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt> {
    let { onTxnHash } = txnOptions ?? {};

    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitUntilTransactionMined(this.ethersProvider, txnHash);
    }

    let safeAddress = safeAddressOrTxnHash;

    if (!safeAddress) {
      throw new Error('safeAddress must be provided');
    }
    if (!moduleAddress) {
      throw new Error('moduleAddress must be provided');
    }
    if (!gasTokenAddress) {
      throw new Error('gasTokenAddress must be provided');
    }
    if (!spHash) {
      throw new Error('spHash must be provided');
    }

    let nonce, estimate, payload, signature;

    if (txnParams && Object.keys(txnParams).length > 0) {
      ({ nonce, estimate, payload, signature } = txnParams);
    } else {
      ({ nonce, estimate, payload, signature } = await this.generateCancelPaymentTxParams(
        safeAddress,
        moduleAddress,
        gasTokenAddress,
        spHash
      ));
    }

    let gnosisTxn = await executeTransaction(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      [signature]
    );

    let txnHash = gnosisTxn.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return await waitUntilTransactionMined(this.ethersProvider, txnHash);
  }

  async executeScheduledPayment(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async executeScheduledPayment(
    moduleAddressOrTxnHash: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    feeFixedUSD: number,
    feePercentage: number,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    gasPrice: string,
    payAt?: number | null,
    recurringDayOfMonth?: number | null,
    recurringUntil?: number | null,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async executeScheduledPayment(
    moduleAddressOrTxnHash: string,
    tokenAddress?: string,
    amount?: string,
    payeeAddress?: string,
    feeFixedUSD?: number,
    feePercentage?: number,
    executionGas?: number,
    maxGasPrice?: string,
    gasTokenAddress?: string,
    salt?: string,
    gasPrice?: string,
    payAt?: number | null,
    recurringDayOfMonth?: number | null,
    recurringUntil?: number | null,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (!moduleAddressOrTxnHash) {
      throw new Error('moduleAddressOrTxnHash must be specified');
    }
    if (isTransactionHash(moduleAddressOrTxnHash)) {
      let txnHash = moduleAddressOrTxnHash;
      return await waitUntilTransactionMined(this.ethersProvider, txnHash);
    }

    let moduleAddress = moduleAddressOrTxnHash;
    if (!moduleAddress) throw new Error('moduleAddress must be provided');
    if (!tokenAddress) throw new Error('tokenAddress must be provided ');
    if (!amount) throw new Error('amount must be provided');
    if (!payeeAddress) throw new Error('payeeAddress must be provided');
    if (feeFixedUSD == undefined) throw new Error('feeFixedUSD must be provided');
    if (feePercentage == undefined) throw new Error('feePercentage must be provided');
    if (!executionGas) throw new Error('executionGas must be provided');
    if (!maxGasPrice) throw new Error('maxGasPrice must be provided');
    if (!gasTokenAddress) throw new Error('gasTokenAddress must be provided ');
    if (!salt) throw new Error('salt must be provided');
    if (payAt == null && (recurringDayOfMonth == null || recurringUntil == null))
      throw new Error('When payAt is null, recurringDayOfMonth and recurringUntil must have a value');
    if (payAt != null && (recurringDayOfMonth != null || recurringUntil != null))
      throw new Error('When payAt is not null, recurringDayOfMonth and recurringUntil must be null');

    let { onTxnHash, nonce } = txnOptions ?? {};
    let module = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    let executeScheduledPaymentData;
    if (recurringUntil) {
      executeScheduledPaymentData = module.interface.encodeFunctionData(
        'executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)',
        [
          tokenAddress,
          amount,
          payeeAddress,
          this.composeFees(feeFixedUSD, feePercentage),
          executionGas,
          maxGasPrice,
          gasTokenAddress,
          salt,
          recurringDayOfMonth,
          recurringUntil,
          gasPrice,
        ]
      );
    } else {
      executeScheduledPaymentData = module.interface.encodeFunctionData(
        'executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)',
        [
          tokenAddress,
          amount,
          payeeAddress,
          this.composeFees(feeFixedUSD, feePercentage),
          executionGas,
          maxGasPrice,
          gasTokenAddress,
          salt,
          payAt,
          gasPrice,
        ]
      );
    }

    let executeScheduledPaymentTx = {
      to: moduleAddress,
      value: '0',
      data: executeScheduledPaymentData,
      operation: Operation.CALL,
    };
    try {
      let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
      let response = await signer.sendTransaction({
        to: executeScheduledPaymentTx.to,
        data: executeScheduledPaymentTx.data,
        nonce: nonce ? BigNumber.from(nonce.toString()) : undefined,
      });
      if (typeof onTxnHash === 'function') {
        await onTxnHash(response.hash);
      }
      return await waitUntilTransactionMined(this.ethersProvider, response.hash);
    } catch (e: any) {
      // UnknownHash: payment details generate unregistered spHash
      // InvalidPeriod: one-time payment executed before payAt
      // or recurring payment executed on the day before the recurringDayOfMonth
      // or recurring payments executed before the next 28 days or more than the last recurring payment
      // or ecurring payment executed after the recurringUntil
      // ExceedMaxGasPrice: gasPrice must be lower than or equal maxGasPrice
      // PaymentExecutionFailed: safe balance is not enough to make payments and pay fees
      // OutOfGas: executionGas to low to execute scheduled payment
      throw new Error(extractSendTransactionErrorMessage(e, new Interface(ScheduledPaymentABI)));
    }
  }

  // Use the hub as a proxy to estimate
  // to make the estimation process faster
  // and doesn't requiring user to have enough balance of token transfer & gas token
  async estimateGas(
    scenario: GasEstimationScenario,
    options: {
      safeAddress?: string | null;
      hubUrl?: string | null;
    }
  ): Promise<GasEstimationResult> {
    let chainId = (await this.ethersProvider.getNetwork()).chainId;
    const network = convertChainIdToName(chainId);
    let body = {
      data: {
        attributes: {
          scenario: scenario,
          'chain-id': chainId,
          'safe-address': options.safeAddress,
        },
      },
    };
    let gasEstimationResponse = await fetch(
      `${options.hubUrl || getConstantByNetwork('hubUrl', network)}/api/gas-estimation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
        body: JSON.stringify(body),
      }
    );
    let gasStationResponse = await getGasPricesInNativeWei(chainId, { hubUrl: options.hubUrl });
    let gas = BigNumber.from((await gasEstimationResponse.json()).data?.attributes?.gas);
    let gasRangeInWei = {
      slow: gas.mul(String(gasStationResponse.slow)),
      standard: gas.mul(String(gasStationResponse.standard)),
      fast: gas.mul(String(gasStationResponse.fast)),
    };

    let usdStableCoinToken = await getAddress('usdStableCoinToken', this.ethersProvider);
    if (!usdStableCoinToken) throw Error('USD Stable Coin token not found');
    let priceWeiInUSD = String(await getNativeWeiInToken(this.ethersProvider, usdStableCoinToken));
    let gasRangeInUSD = {
      slow: gasRangeInWei.slow.mul(priceWeiInUSD),
      standard: gasRangeInWei.standard.mul(priceWeiInUSD),
      fast: gasRangeInWei.fast.mul(priceWeiInUSD),
    };

    return {
      gas,
      gasRangeInWei,
      gasRangeInUSD,
    };
  }

  async getValidForDays(): Promise<number> {
    let configModuleAddress = await getAddress('scheduledPaymentConfig', this.ethersProvider);
    const scheduledPaymentConfig = new Contract(configModuleAddress, ScheduledPaymentConfigABI, this.ethersProvider);
    return await scheduledPaymentConfig.validForDays();
  }

  private composeFees(feeFixedUSD: number, feePercentage: number) {
    // We can use toWei because decimals of Decimal.D256 is 18
    return {
      fixedUSD: {
        value: toWei(String(feeFixedUSD), 'ether'),
      },
      percentage: {
        value: new BN(toWei(String(feePercentage), 'ether')).div(new BN(100)).toString(),
      },
    };
  }
}
