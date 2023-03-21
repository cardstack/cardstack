import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import { getAddress } from '../contracts/addresses';
import {
  encodeMultiSend,
  encodeMultiSendCallOnly,
  getModuleProxyCreationEvent,
  deployAndSetUpModule,
  SetupArgs,
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
  executeTransaction,
  gasEstimate,
  generateCreate2SafeTx,
  getNextNonceFromEstimate,
  getSafeProxyCreationEvent,
  Operation,
} from './utils/safe-utils';
import { BigNumber, Contract, ContractInterface, Signer, utils } from 'ethers';
import { signSafeTx, signSafeTxAsBytes } from './utils/signing-utils';
import { AddressKeys, ERC20ABI } from '..';
/* eslint-disable node/no-extraneous-import */
import { AddressZero } from '@ethersproject/constants';
import BN from 'bn.js';
import JsonRpcProvider from '../providers/json-rpc-provider';
import { camelCase } from 'lodash';

/**
 * @hidden
 */
export interface EnableModule {
  moduleAddress: string;
}

/**
 * @hidden
 */
export interface EnableModuleAndGuardResult extends EnableModule {
  metaGuardAddress: string;
}

/**
 * @hidden
 */
export interface CreateSafeWithModuleResult {
  safeAddress: string;
  moduleAddress: string;
}
/**
 * @hidden
 */
export interface CreateSafeWithModuleAndGuardResult extends CreateSafeWithModuleResult {
  metaGuardAddress: string;
}

/**
 * @hidden
 */
export interface CreateSafeWithModuleTx {
  multiSendCallOnlyTx: Transaction;
  expectedSafeAddress: string;
  expectedModuleAddress: string;
}

/**
 * @hidden
 */
export interface CreateSafeWithModuleAndGuardTx extends CreateSafeWithModuleTx {
  expectedMetaGuardAddress: string;
}

/**
 * @hidden
 */
export interface ModuleDetails {
  owner: string;
  avatar: string;
  target: string;
}

type GasRange = Record<'slow' | 'standard' | 'fast', BigNumber>;
/**
 * @hidden
 */
export interface GasEstimationResult {
  gas: BigNumber;
  gasRangeInWei: GasRange;
  gasRangeInUSD: GasRange;
}

/**
 * @hidden
 */
export const FEE_BASE_POW = new BN(18);
/**
 * @hidden
 */
export const FEE_BASE = new BN(10).pow(FEE_BASE_POW);

/**
 * @hidden
 */
export default abstract class SafeModule {
  public name: AddressKeys;
  public abstract safeSalt: string;
  public abstract moduleSalt: string;
  public abstract abi: ContractInterface;

  constructor(protected ethersProvider: JsonRpcProvider, protected signer?: Signer) {
    this.signer = signer ? signer.connect(ethersProvider) : signer;
    this.ethersProvider = ethersProvider;
    this.name = camelCase(this.constructor.name) as AddressKeys;
  }

  abstract setupArgs(safeAddress: string, safeOwners?: string[]): SetupArgs;

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
      generateSaltNonce(this.safeSalt)
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
        `Safe does not have enough balance to enable ${
          this.name
        } module. The gas token ${gasTokenAddress} balance of the safe ${safeAddress} is ${utils.formatUnits(
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
      moduleAddress: enableModuleTxs.expectedModuleAddress,
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
      generateSaltNonce(this.safeSalt)
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
      expectedModuleAddress: enableModuleTxs.expectedModuleAddress,
      expectedMetaGuardAddress: setGuardTxs.expectedModuleAddress,
    };
  }

  async createSafeWithModuleAndGuard(
    txnHash?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<CreateSafeWithModuleAndGuardResult> {
    if (txnHash && isTransactionHash(txnHash)) {
      let safeAddress = await this.getSafeAddressFromTxn(txnHash);
      let { moduleAddress, metaGuardAddress } = await this.getModuleAndGuardAddressFromTxn(txnHash);
      return {
        safeAddress,
        moduleAddress,
        metaGuardAddress,
      };
    }

    let { onTxnHash } = txnOptions ?? {};
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let { multiSendCallOnlyTx, expectedSafeAddress, expectedModuleAddress, expectedMetaGuardAddress } =
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
      moduleAddress: expectedModuleAddress,
      metaGuardAddress: expectedMetaGuardAddress,
    };
  }

  async generateEnableModuleTxs(safeAddress: string, safeOwners: string[] = []) {
    let masterCopy = new Contract(await getAddress(this.name, this.ethersProvider), this.abi, this.ethersProvider);
    let args = this.setupArgs(safeAddress, safeOwners);
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(
      this.ethersProvider,
      masterCopy,
      args,
      this.moduleSalt
    );
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
    //TODO: salt nonce in deployAndSetup
    let masterCopy = new Contract(
      await getAddress('metaGuard', this.ethersProvider),
      MetaGuardABI,
      this.ethersProvider
    );
    let { transaction, expectedModuleAddress } = await deployAndSetUpModule(
      this.ethersProvider,
      masterCopy,
      {
        types: ['address', 'address', 'uint256', 'address[]'],
        values: [safeAddress, safeAddress, 0, []],
      },
      this.moduleSalt
    );
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
    let moduleMasterCopy = await getAddress(this.name, this.ethersProvider);
    let metaGuardMasterCopy = await getAddress('metaGuard', this.ethersProvider);
    let moduleAddress = moduleProxyCreationEvents.find((event) => event.args['masterCopy'] === moduleMasterCopy)?.args[
      'proxy'
    ];
    let metaGuardAddress = moduleProxyCreationEvents.find((event) => event.args['masterCopy'] === metaGuardMasterCopy)
      ?.args['proxy'];
    return {
      moduleAddress,
      metaGuardAddress,
    };
  }

  async getDetails(moduleAddress: string): Promise<ModuleDetails> {
    const module = new Contract(moduleAddress, this.abi, this.ethersProvider);
    const owner = await module.owner();
    const target = await module.target();
    const avatar = await module.avatar();
    return {
      owner,
      target,
      avatar,
    };
  }

  async createSafeWithModule(
    txnHash?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<CreateSafeWithModuleResult> {
    if (txnHash && isTransactionHash(txnHash)) {
      let safeAddress = await this.getSafeAddressFromTxn(txnHash);
      let { moduleAddress } = await this.getModuleAndGuardAddressFromTxn(txnHash);
      return {
        safeAddress,
        moduleAddress,
      };
    }

    let { onTxnHash } = txnOptions ?? {};
    let signer = this.signer ? this.signer : this.ethersProvider.getSigner();
    let from = contractOptions?.from ?? (await signer.getAddress());

    let { multiSendCallOnlyTx, expectedSafeAddress, expectedModuleAddress } = await this.createSafeWithModuleTx(from);
    let response = await signer.sendTransaction({
      to: multiSendCallOnlyTx.to,
      data: multiSendCallOnlyTx.data,
    });

    if (typeof onTxnHash === 'function') {
      await onTxnHash(response.hash);
    }

    return {
      safeAddress: expectedSafeAddress,
      moduleAddress: expectedModuleAddress,
    };
  }

  async createSafeWithModuleTx(from: string): Promise<CreateSafeWithModuleTx> {
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
      generateSaltNonce(this.safeSalt)
    );
    let enableModuleTxs = await this.generateEnableModuleTxs(expectedSafeAddress, [from]);

    let multiSendTx = await encodeMultiSend(this.ethersProvider, [...enableModuleTxs.txs]);
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
      expectedModuleAddress: enableModuleTxs.expectedModuleAddress,
    };
  }
}
