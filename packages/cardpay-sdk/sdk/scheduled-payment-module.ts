import Web3 from 'web3';
import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import ScheduledPaymentABI from '../contracts/abi/modules/scheduled-payment-module';
import { getAddress } from '../contracts/addresses';
import { AbiItem, fromWei } from 'web3-utils';
import {
  deployAndSetUpModule,
  encodeMultiSend,
  encodeMultiSendCallOnly,
  getModuleProxyCreationEvent,
} from './utils/module-utils';
import {
  generateSaltNonce,
  isTransactionHash,
  sendTransaction,
  Transaction,
  TransactionOptions,
  waitUntilTransactionMined,
} from './utils/general-utils';

import { ContractOptions } from 'web3-eth-contract';
import {
  EventABI,
  executeTransaction,
  gasEstimate,
  generateCreate2SafeTx,
  getNextNonceFromEstimate,
  getParamsFromEvent,
  Operation,
} from './utils/safe-utils';
import { Signer, utils } from 'ethers';
import { signSafeTx, signSafeTxAsBytes, Signature } from './utils/signing-utils';
import { BN } from 'bn.js';
import { ERC20ABI } from '..';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
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
  constructor(private web3: Web3, private layer2Signer?: Signer) {}

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
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.web3.eth.getAccounts())[0];

    let enableModuleTxs = await this.generateEnableModuleTxs(safeAddress);
    let setGuardTxs = await this.generateSetGuardTxs(safeAddress);

    let multiSendTransaction = await encodeMultiSend(this.web3, [...enableModuleTxs.txs, ...setGuardTxs.txs]);

    let estimate = await gasEstimate(
      this.web3,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.value,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      gasTokenAddress ? gasTokenAddress : AddressZero
    );
    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));

    let token = new this.web3.eth.Contract(ERC20ABI as AbiItem[], gasTokenAddress);
    let symbol = await token.methods.symbol().call();
    let balance = new BN(await token.methods.balanceOf(safeAddress).call());
    if (balance.lt(gasCost)) {
      throw new Error(
        `Safe does not have enough balance to enable scheduled payment module. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the the gas cost is ${fromWei(gasCost)} ${symbol}`
      );
    }
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let gnosisTxn = await executeTransaction(
      this.web3,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      estimate,
      nonce,
      await signSafeTx(
        this.web3,
        safeAddress,
        multiSendTransaction.to,
        multiSendTransaction.data,
        multiSendTransaction.operation,
        estimate,
        nonce,
        from,
        this.layer2Signer
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
    let from = contractOptions?.from ?? (await this.web3.eth.getAccounts())[0];

    let { expectedSafeAddress, create2SafeTx } = await generateCreate2SafeTx(
      this.web3,
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

    let multiSendTx = await encodeMultiSend(this.web3, [...enableModuleTxs.txs, ...setGuardTxs.txs]);
    let gnosisSafe = new this.web3.eth.Contract(GnosisSafeABI as AbiItem[], expectedSafeAddress);
    let estimate = await gasEstimate(
      this.web3,
      await getAddress('gnosisSafeMasterCopy', this.web3),
      multiSendTx.to,
      multiSendTx.value,
      multiSendTx.data,
      multiSendTx.operation,
      AddressZero
    );
    let nonce = new BN('0');
    let gasPrice = '0';
    let [signature] = await signSafeTxAsBytes(
      this.web3,
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
      gnosisSafe.options.address,
      this.layer2Signer
    );
    let safeTxData = gnosisSafe.methods
      .execTransaction(
        multiSendTx.to,
        Number(multiSendTx.value),
        multiSendTx.data,
        multiSendTx.operation,
        estimate.safeTxGas,
        estimate.baseGas,
        gasPrice,
        estimate.gasToken,
        estimate.refundReceiver,
        signature
      )
      .encodeABI();
    let safeTx: Transaction = {
      to: expectedSafeAddress,
      value: '0',
      data: safeTxData,
      operation: Operation.CALL,
    };
    let multiSendCallOnlyTx = await encodeMultiSendCallOnly(this.web3, [create2SafeTx, safeTx]);
    let txHash = await sendTransaction(this.web3, multiSendCallOnlyTx);

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txHash);
    }

    return {
      safeAddress: expectedSafeAddress,
      scheduledPaymentModuleAddress: enableModuleTxs.expectedModuleAddress,
      metaGuardAddress: setGuardTxs.expectedModuleAddress,
    };
  }

  async generateEnableModuleTxs(safeAddress: string) {
    let masterCopy = new this.web3.eth.Contract(
      ScheduledPaymentABI as AbiItem[],
      await getAddress('scheduledPaymentModule', this.web3)
    );
    let configAddress = await getAddress('scheduledPaymentConfig', this.web3);
    let exchangeAddress = await getAddress('scheduledPaymentExchange', this.web3);
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.web3, masterCopy, {
      types: ['address', 'address', 'address', 'address', 'address'],
      values: [safeAddress, safeAddress, safeAddress, configAddress, exchangeAddress],
    });

    let safe = new this.web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
    let enableModuleData = safe.methods.enableModule(expectedModuleAddress).encodeABI();
    let enableModuleTransaction = {
      data: enableModuleData,
      to: safeAddress,
      value: '0',
      operation: Operation.CALL,
    };

    return { txs: [transaction, enableModuleTransaction], expectedModuleAddress };
  }

  async generateSetGuardTxs(safeAddress: string) {
    let masterCopy = new this.web3.eth.Contract(MetaGuardABI as AbiItem[], await getAddress('metaGuard', this.web3));
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.web3, masterCopy, {
      types: ['address', 'address', 'uint256', 'address[]'],
      values: [safeAddress, safeAddress, 0, []],
    });

    let safe = new this.web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
    let setGuardData = safe.methods.setGuard(expectedModuleAddress).encodeABI();
    let setGuardTransaction = {
      data: setGuardData,
      to: safeAddress,
      value: '0',
      operation: Operation.CALL,
    };

    return { txs: [transaction, setGuardTransaction], expectedModuleAddress };
  }

  async getSafeAddressFromTxn(txnHash: string): Promise<string> {
    let receipt = await waitUntilTransactionMined(this.web3, txnHash);
    let params = getParamsFromEvent(
      this.web3,
      receipt,
      this.safeProxyCreationEventABI(),
      await getAddress('gnosisProxyFactory_v1_3', this.web3)
    );
    return params[0].proxy;
  }

  private safeProxyCreationEventABI(): EventABI {
    return {
      topic: this.web3.eth.abi.encodeEventSignature('ProxyCreation(address,address)'),
      abis: [
        {
          name: 'proxy',
          type: 'address',
          indexed: false,
        },
        {
          name: 'singleton',
          type: 'address',
          indexed: false,
        },
      ],
    };
  }

  async getModuleAndGuardAddressFromTxn(txnHash: string): Promise<EnableModuleAndGuardResult> {
    let receipt = await waitUntilTransactionMined(this.web3, txnHash);
    let moduleProxyCreationEvents = await getModuleProxyCreationEvent(this.web3, receipt.logs);
    let scheduledPaymentMasterCopy = await getAddress('scheduledPaymentModule', this.web3);
    let metaGuardMasterCopy = await getAddress('metaGuard', this.web3);
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
      let module = new this.web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
      if (recurringUntil) {
        let recurringDayOfMonth = payAtOrRecurringDayOfMonth;
        await module.methods[
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
        ).estimateGas();
      } else {
        let payAt = payAtOrRecurringDayOfMonth;
        await module.methods[
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
        ).estimateGas();
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
      return await waitUntilTransactionMined(this.web3, txnHash);
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
    let from = contractOptions?.from ?? (await this.web3.eth.getAccounts())[0];

    let scheduledPaymentModule = new this.web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
    let spHashes = await scheduledPaymentModule.methods.getSpHashes().call();
    if (!spHashes.includes(spHash)) {
      throw new Error(`unknown spHash`);
    }

    let cancelScheduledPaymentData = scheduledPaymentModule.methods.cancelScheduledPayment(spHash).encodeABI();
    let estimate = await gasEstimate(
      this.web3,
      safeAddress,
      moduleAddress,
      '0',
      cancelScheduledPaymentData,
      Operation.CALL,
      gasTokenAddress
    );
    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));

    let token = new this.web3.eth.Contract(ERC20ABI as AbiItem[], gasTokenAddress);
    let symbol = await token.methods.symbol().call();
    let balance = new BN(await token.methods.balanceOf(safeAddress).call());
    if (balance.lt(gasCost)) {
      throw new Error(
        `Safe does not have enough balance to cancel scheduled payment. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the the gas cost is ${fromWei(gasCost)} ${symbol}`
      );
    }
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let gnosisTxn = await executeTransaction(
      this.web3,
      safeAddress,
      moduleAddress,
      cancelScheduledPaymentData,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.web3,
        safeAddress,
        moduleAddress,
        cancelScheduledPaymentData,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.layer2Signer
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
    let module = new this.web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
    if (recurringUntil) {
      let recurringDayOfMonth = payAtOrRecurringDayOfMonth;
      spHash = await module.methods[
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
      ).call();
    } else {
      let payAt = payAtOrRecurringDayOfMonth;
      spHash = await module.methods[
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
      ).call();
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

    let from = (await this.web3.eth.getAccounts())[0];

    let signature = (
      await signSafeTx(
        this.web3,
        safeAddress,
        moduleAddress,
        payload,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.layer2Signer
      )
    )[0];

    return signature;
  }

  private async generateSchedulePaymentTxParams(
    safeAddress: string,
    moduleAddress: string,
    gasTokenAddress: string,
    spHash: string
  ) {
    let contract = new this.web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
    let payload = await contract.methods.schedulePayment(spHash).encodeABI();

    let estimate = await gasEstimate(
      this.web3,
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
      return await waitUntilTransactionMined(this.web3, txnHash);
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
      this.web3,
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

    return await waitUntilTransactionMined(this.web3, txnHash);
  }
}
