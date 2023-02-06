/*global fetch */

import GnosisSafeABI from '../contracts/abi/gnosis-safe';
import MetaGuardABI from '../contracts/abi/modules/meta-guard';
import ScheduledPaymentABI from '../contracts/abi/modules/scheduled-payment-module';
import { getAddress } from '../contracts/addresses';
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
  executeTransaction,
  gasEstimate,
  generateCreate2SafeTx,
  getNextNonceFromEstimate,
  getSafeProxyCreationEvent,
  Operation,
} from './utils/safe-utils';
import { BigNumber, Contract, Signer, utils } from 'ethers';
import { signSafeTx, signSafeTxAsBytes } from './utils/signing-utils';
import { convertChainIdToName, ERC20ABI } from '../dist';
/* eslint-disable node/no-extraneous-import */
import { AddressZero } from '@ethersproject/constants';
import { GasEstimationScenario } from './scheduled-payment/utils';
import BN from 'bn.js';
import JsonRpcProvider from '../providers/json-rpc-provider';
import { getConstantByNetwork } from './constants';
import { getGasPricesInNativeWei, getNativeWeiInToken } from './utils/conversions';

export interface EnableModuleAndGuardResult {
  moduleAddress: string;
  metaGuardAddress: string;
}

export interface CreateSafeWithModuleAndGuardResult {
  safeAddress: string;
  moduleAddress: string;
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

export const FEE_BASE_POW = new BN(18);
export const FEE_BASE = new BN(10).pow(FEE_BASE_POW);

export default class SafeModule {
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
      moduleAddress: expectedSPModuleAddress,
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
    let moduleAddress = moduleProxyCreationEvents.find(
      (event) => event.args['masterCopy'] === scheduledPaymentMasterCopy
    )?.args['proxy'];
    let metaGuardAddress = moduleProxyCreationEvents.find((event) => event.args['masterCopy'] === metaGuardMasterCopy)
      ?.args['proxy'];
    return {
      moduleAddress,
      metaGuardAddress,
    };
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
}
