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
import { isTransactionHash, sendTransaction, Transaction, TransactionOptions } from './utils/general-utils';
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
import { Signer } from 'ethers';
import { signSafeTx, signSafeTxAsBytes } from './utils/signing-utils';
import { BN } from 'bn.js';
import { ERC20ABI, waitUntilTransactionMined } from '..';
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

export default class ScheduledPaymentModule {
  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

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
      gasTokenAddress ? gasTokenAddress : AddressZero
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
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    let { expectedSafeAddress, create2SafeTx } = await generateCreate2SafeTx(
      this.layer2Web3,
      [from],
      1,
      AddressZero,
      '0x',
      AddressZero,
      AddressZero,
      '0',
      AddressZero,
      new Date().getTime()
    );
    let enableModuleTxs = await this.generateEnableModuleTxs(expectedSafeAddress);
    let setGuardTxs = await this.generateSetGuardTxs(expectedSafeAddress);

    let multiSendTx = await encodeMultiSend(this.layer2Web3, [...enableModuleTxs.txs, ...setGuardTxs.txs]);
    let gnosisSafe = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], expectedSafeAddress);
    let estimate = await gasEstimate(
      this.layer2Web3,
      await getAddress('gnosisSafeMasterCopy', this.layer2Web3),
      multiSendTx.to,
      multiSendTx.value,
      multiSendTx.data,
      multiSendTx.operation,
      AddressZero
    );
    let nonce = new BN('0');
    let gasPrice = '0';
    let [signature] = await signSafeTxAsBytes(
      this.layer2Web3,
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
    let multiSendCallOnlyTx = await encodeMultiSendCallOnly(this.layer2Web3, [create2SafeTx, safeTx]);
    let txHash = await sendTransaction(this.layer2Web3, multiSendCallOnlyTx);

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

  async getSafeAddressFromTxn(txnHash: string): Promise<string> {
    let receipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    let params = getParamsFromEvent(
      this.layer2Web3,
      receipt,
      this.safeProxyCreationEventABI(),
      await getAddress('gnosisProxyFactory_v1_3', this.layer2Web3)
    );
    return params[0].proxy;
  }

  private safeProxyCreationEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature('ProxyCreation(address,address)'),
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
    let receipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    let moduleProxyCreationEvents = await getModuleProxyCreationEvent(this.layer2Web3, receipt.logs);
    let scheduledPaymentMasterCopy = await getAddress('scheduledPaymentModule', this.layer2Web3);
    let metaGuardMasterCopy = await getAddress('metaGuard', this.layer2Web3);
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
}
