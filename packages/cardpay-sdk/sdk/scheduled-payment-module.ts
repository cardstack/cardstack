import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import ScheduledPaymentABI from '../contracts/abi/modules/scheduled-payment-module';
import { getAddress } from '../contracts/addresses';
import { fromWei } from 'web3-utils';
import {
  deployAndSetUpModule,
  encodeMultiSend,
  encodeMultiSendCallOnly,
  getModuleProxyCreationEvent,
} from './utils/module-utils';
import {
  generateSaltNonce,
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
import BN from 'bn.js';
import { ERC20ABI } from '..';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
import JsonRpcProvider from '../providers/json-rpc-provider';
/* eslint-disable node/no-extraneous-import */
import { AddressZero } from '@ethersproject/constants';

export interface EnableModuleAndGuardResult {
  scheduledPaymentModuleAddress: string;
  metaGuardAddress: string;
}

export interface CreateSafeWithModuleAndGuardResult {
  safeAddress: string;
  scheduledPaymentModuleAddress: string;
  metaGuardAddress: string;
}

export interface Fee {
  fixedUSD: number;
  percentage: number;
}
export const FEE_BASE_POW = new BN(18);
export const FEE_BASE = new BN(10).pow(FEE_BASE_POW);

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
      gasTokenAddress
    );
    let gasCost = BigNumber.from(estimate.safeTxGas)
      .add(BigNumber.from(estimate.baseGas))
      .mul(BigNumber.from(estimate.gasPrice));

    let token = new Contract(gasTokenAddress, ERC20ABI, this.ethersProvider);
    let symbol = await token.symbol();
    let balance = await token.callStatic.balanceOf(safeAddress);
    if (balance.lt(gasCost)) {
      throw new Error(
        `Safe does not have enough balance to enable scheduled payment module. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the the gas cost is ${utils.formatUnits(gasCost, 'wei')} ${symbol}`
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

  async createSafeWithModuleAndGuard(
    txnHash?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<CreateSafeWithModuleAndGuardResult> {
    txnHash = txnHash ? txnHash : '';
    if (isTransactionHash(txnHash)) {
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
    let enableModuleTxs = await this.generateEnableModuleTxs(expectedSafeAddress);
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
      AddressZero
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
    let response = await signer.sendTransaction({
      to: multiSendCallOnlyTx.to,
      data: multiSendCallOnlyTx.data,
    });

    if (typeof onTxnHash === 'function') {
      await onTxnHash(response.hash);
    }

    return {
      safeAddress: expectedSafeAddress,
      scheduledPaymentModuleAddress: enableModuleTxs.expectedModuleAddress,
      metaGuardAddress: setGuardTxs.expectedModuleAddress,
    };
  }

  async generateEnableModuleTxs(safeAddress: string) {
    let masterCopy = new Contract(
      await getAddress('scheduledPaymentModule', this.ethersProvider),
      ScheduledPaymentABI,
      this.ethersProvider
    );
    let configAddress = await getAddress('scheduledPaymentConfig', this.ethersProvider);
    let exchangeAddress = await getAddress('scheduledPaymentExchange', this.ethersProvider);
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.ethersProvider, masterCopy, {
      types: ['address', 'address', 'address', 'address', 'address'],
      values: [safeAddress, safeAddress, safeAddress, configAddress, exchangeAddress],
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
    fee: Fee,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    payAt: number,
    gasPrice: string
  ): Promise<number>;
  async estimateExecutionGas(
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    fee: Fee,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    recurringDayOfMonth: number,
    gasPrice: string,
    recurringUntil: number
  ): Promise<number>;
  async estimateExecutionGas(
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    fee: Fee,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    payAtOrRecurringDayOfMonth: number,
    gasPrice: string,
    recurringUntil?: number
  ): Promise<number> {
    let getRequiredGasFromRevertMessage = function (e: any): number {
      let requiredGas;
      let _interface = new utils.Interface(['error GasEstimation(uint256 gas)']);
      if (e.data) {
        let decodedError = _interface.parseError(e.data);
        requiredGas = decodedError.args[0].toNumber();
      } else {
        let messages = e.message.split(' ');
        let decodedError = _interface.parseError(messages[2].replace(',', ''));
        requiredGas = decodedError.args[0].toNumber();
      }
      return requiredGas;
    };

    let requiredGas = 0;
    try {
      let module = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
      if (recurringUntil) {
        let recurringDayOfMonth = payAtOrRecurringDayOfMonth;
        await module.estimateGas[
          'estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256,uint256)'
        ](
          tokenAddress,
          amount,
          payeeAddress,
          {
            fixedUSD: {
              value: FEE_BASE.mul(new BN(fee.fixedUSD)).toString(),
            },
            percentage: {
              value: FEE_BASE.mul(new BN(fee.percentage)).toString(),
            },
          },
          maxGasPrice,
          gasTokenAddress,
          salt,
          recurringDayOfMonth,
          recurringUntil,
          gasPrice
        );
      } else {
        let payAt = payAtOrRecurringDayOfMonth;
        await module.estimateGas[
          'estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256)'
        ](
          tokenAddress,
          amount,
          payeeAddress,
          {
            fixedUSD: {
              value: FEE_BASE.mul(new BN(fee.fixedUSD)).toString(),
            },
            percentage: {
              value: FEE_BASE.mul(new BN(fee.percentage)).toString(),
            },
          },
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

    return requiredGas;
  }

  async cancelScheduledPayment(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async cancelScheduledPayment(
    safeAddress: string,
    moduleAddress: string,
    spHash: string,
    gasTokenAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<void>;
  async cancelScheduledPayment(
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
      gasTokenAddress
    );
    let gasCost = BigNumber.from(estimate.safeTxGas)
      .add(BigNumber.from(estimate.baseGas))
      .mul(BigNumber.from(estimate.gasPrice));

    let token = new Contract(gasTokenAddress, ERC20ABI, this.ethersProvider);
    let symbol = await token.callStatic.symbol();
    let balance = await token.callStatic.balanceOf(safeAddress);
    if (balance.lt(gasCost)) {
      throw new Error(
        `Safe does not have enough balance to cancel scheduled payment. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the the gas cost is ${utils.formatUnits(gasCost, 'wei')} ${symbol}`
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
    fee: Fee,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    payAt: number
  ): Promise<string>;
  async createSpHash(
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    fee: Fee,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    recurringDayOfMonth: number,
    recurringUntil: number
  ): Promise<string>;
  async createSpHash(
    moduleAddress: string,
    tokenAddress: string,
    amount: string,
    payeeAddress: string,
    fee: Fee,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: string,
    salt: string,
    payAtOrRecurringDayOfMonth: number,
    recurringUntil?: number
  ): Promise<string> {
    let spHash;
    let module = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    if (recurringUntil) {
      let recurringDayOfMonth = payAtOrRecurringDayOfMonth;
      spHash = await module.callStatic[
        'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)'
      ](
        tokenAddress,
        amount,
        payeeAddress,
        {
          fixedUSD: {
            value: FEE_BASE.mul(new BN(fee.fixedUSD)).toString(),
          },
          percentage: {
            value: FEE_BASE.mul(new BN(fee.percentage)).toString(),
          },
        },
        executionGas,
        maxGasPrice,
        gasTokenAddress,
        salt,
        recurringDayOfMonth,
        recurringUntil
      );
    } else {
      let payAt = payAtOrRecurringDayOfMonth;
      spHash = await module.callStatic[
        'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)'
      ](
        tokenAddress,
        amount,
        payeeAddress,
        {
          fixedUSD: {
            value: FEE_BASE.mul(new BN(fee.fixedUSD)).toString(),
          },
          percentage: {
            value: FEE_BASE.mul(new BN(fee.percentage)).toString(),
          },
        },
        executionGas,
        maxGasPrice,
        gasTokenAddress,
        salt,
        payAt
      );
    }

    return spHash;
  }

  async generateSchedulePaymentSignature(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string
  ) {
    let [nonce, estimate, payload] = await this.generateSchedulePaymentTxParams(
      safeAddress,
      moduleAddress,
      gasTokenAddress,
      spHash
    );

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

    return signature;
  }

  private async generateSchedulePaymentTxParams(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string
  ): Promise<[BN, Estimate, string]> {
    let contract = new Contract(moduleAddress, ScheduledPaymentABI, this.ethersProvider);
    let payload = contract.interface.encodeFunctionData('schedulePayment', [spHash]);

    let estimate = await gasEstimate(
      this.ethersProvider,
      safeAddress,
      moduleAddress,
      '0',
      payload,
      Operation.CALL,
      gasTokenAddress
    );

    let nonce = getNextNonceFromEstimate(estimate);

    return [nonce, estimate, payload];
  }

  async schedulePayment(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async schedulePayment(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string,
    signature?: Signature | null,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async schedulePayment(
    safeAddressOrTxnHash: string,
    moduleAddress?: string,
    gasTokenAddress?: string,
    spHash?: string,
    signature?: Signature | null,
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

    let [nonce, estimate, payload] = await this.generateSchedulePaymentTxParams(
      safeAddress,
      moduleAddress,
      gasTokenAddress,
      spHash
    );

    if (!signature) {
      signature = await this.generateSchedulePaymentSignature(safeAddress, moduleAddress, gasTokenAddress, spHash);
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
}
