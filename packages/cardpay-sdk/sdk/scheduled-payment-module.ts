import Web3 from 'web3';
import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import ScheduledPaymentABI from '../contracts/abi/modules/scheduled-payment-module';
import { getAddress } from '../contracts/addresses';
import { AbiItem, fromWei } from 'web3-utils';
import { deployAndSetUpModule, encodeMultiSend } from './utils/module-utils';
import { isTransactionHash, TransactionOptions, waitUntilTransactionMined } from './utils/general-utils';
import { ContractOptions } from 'web3-eth-contract';
import { executeTransaction, gasEstimate, getNextNonceFromEstimate, Operation } from './utils/safe-utils';
import { Signer, utils } from 'ethers';
import { signSafeTx } from './utils/signing-utils';
import { BN } from 'bn.js';
import { ERC20ABI } from '..';
import { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';

export interface Fee {
  fixedUSD: number;
  percentage: number;
}
export const FEE_BASE_POW = new BN(18);
export const FEE_BASE = new BN(10).pow(FEE_BASE_POW);
export default class ScheduledPaymentModule {
  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  async enableModule(
    safeAddress: string,
    gasTokenAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ) {
    if (!safeAddress) {
      throw new Error('safeAddress must be specified');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    let enableModuleTxs = await this.generateEnableModuleTxs(safeAddress);
    let setGuardTxs = await this.generateSetGuardTxs(safeAddress);

    let multiSendTransaction = await encodeMultiSend(this.layer2Web3, [...enableModuleTxs.txs, ...setGuardTxs.txs]);

    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.value,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      gasTokenAddress
    );
    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));

    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], gasTokenAddress);
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
      this.layer2Web3,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      estimate,
      nonce,
      await signSafeTx(
        this.layer2Web3,
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

  async generateEnableModuleTxs(safeAddress: string) {
    let masterCopy = new this.layer2Web3.eth.Contract(
      ScheduledPaymentABI as AbiItem[],
      await getAddress('scheduledPaymentModule', this.layer2Web3)
    );
    let configAddress = await getAddress('scheduledPaymentConfig', this.layer2Web3);
    let exchangeAddress = await getAddress('scheduledPaymentExchange', this.layer2Web3);
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.layer2Web3, masterCopy, {
      types: ['address', 'address', 'address', 'address', 'address'],
      values: [safeAddress, safeAddress, safeAddress, configAddress, exchangeAddress],
    });

    let safe = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
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
    let masterCopy = new this.layer2Web3.eth.Contract(
      MetaGuardABI as AbiItem[],
      await getAddress('metaGuard', this.layer2Web3)
    );
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(this.layer2Web3, masterCopy, {
      types: ['address', 'address', 'uint256', 'address[]'],
      values: [safeAddress, safeAddress, 0, []],
    });

    let safe = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
    let setGuardData = safe.methods.setGuard(expectedModuleAddress).encodeABI();
    let setGuardTransaction = {
      data: setGuardData,
      to: safeAddress,
      value: '0',
      operation: Operation.CALL,
    };

    return { txs: [transaction, setGuardTransaction], expectedModuleAddress };
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
    let requiredGas;
    try {
      let module = new this.layer2Web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
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
          gasPrice,
          recurringUntil
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
      let _interface = new utils.Interface(['error GasEstimation(uint256 gas)']);
      let messages = e.message.split(' ');
      let decodedError = _interface.parseError(messages[2].replace(',', ''));
      requiredGas = decodedError.args[0].toNumber();
    }

    return requiredGas;
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
    let module = new this.layer2Web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
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
      return await waitUntilTransactionMined(this.layer2Web3, txnHash);
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
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    let scheduledPaymentModule = new this.layer2Web3.eth.Contract(ScheduledPaymentABI as AbiItem[], moduleAddress);
    let cancelScheduledPaymentData = scheduledPaymentModule.methods.cancelScheduledPayment(spHash).encodeABI();

    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      moduleAddress,
      '0',
      cancelScheduledPaymentData,
      Operation.CALL,
      gasTokenAddress
    );
    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));

    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], gasTokenAddress);
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
      this.layer2Web3,
      safeAddress,
      moduleAddress,
      cancelScheduledPaymentData,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.layer2Web3,
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
}
