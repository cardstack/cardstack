import Web3 from 'web3';
import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import ScheduledPaymentABI from '../contracts/abi/modules/scheduled-payment-module';
import { getAddress } from '../contracts/addresses';
import { AbiItem, fromWei } from 'web3-utils';
import { deployAndSetUpModule, encodeMultiSend } from './utils/module-utils';
import { TransactionOptions, waitForTransactionConsistency } from './utils/general-utils';
import { ContractOptions } from 'web3-eth-contract';
import { executeTransaction, gasEstimate, getNextNonceFromEstimate, Operation } from './utils/safe-utils';
import { Signer } from 'ethers';
import { signSafeTxAsRSV } from './utils/signing-utils';
import { BN } from 'bn.js';
import { ERC20ABI } from '..';
import { ZERO_ADDRESS } from './constants';

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
    let signatures = await signSafeTxAsRSV(
      this.layer2Web3,
      multiSendTransaction.to,
      0,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      estimate.safeTxGas,
      estimate.baseGas,
      estimate.gasPrice,
      estimate.gasToken,
      ZERO_ADDRESS,
      nonce,
      from,
      safeAddress,
      this.layer2Signer
    );
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      multiSendTransaction.to,
      multiSendTransaction.data,
      multiSendTransaction.operation,
      estimate,
      nonce,
      signatures
    );

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }

    return {
      scheduledPaymentModuleAddress: enableModuleTxs.expectedModuleAddress,
      metaGuardAddress: setGuardTxs.expectedModuleAddress,
      txnReceipt: await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, safeAddress, nonce),
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
}
