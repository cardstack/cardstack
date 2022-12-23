import {
  type GasEstimationScenario,
  type ChainAddress,
  getSDK,
  ScheduledPaymentModule,
  getNativeWeiInToken,
  poll,
} from '@cardstack/cardpay-sdk';
import SafesService, {
  Safe,
} from '@cardstack/safe-tools-client/services/safes';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

import { BigNumber } from 'ethers';

const GAS_RANGE_NORMAL_MULTIPLIER = 2;
const GAS_RANGE_HIGH_MULTIPLIER = 4;
const GAS_RANGE_MAX_MULTIPLIER = 6;

export type GasRange = Record<'normal' | 'high' | 'max', BigNumber>;
export interface GasEstimationResult {
  gas: BigNumber;
  gasRangeInGasTokenWei: GasRange;
  gasRangeInUSD: GasRange;
}

export default class SchedulePaymentSDKService extends Service {
  @service declare wallet: WalletService;
  @service declare safes: SafesService;

  estimatedSafeCreationGas: undefined | BigNumber;

  private async getSchedulePaymentsModule(): Promise<ScheduledPaymentModule> {
    const module = await getSDK(
      'ScheduledPaymentModule',
      this.wallet.ethersProvider
    );

    return module;
  }

  private get contractOptions() {
    return { from: this.wallet.address };
  }

  async getCreateSafeGasEstimation(): Promise<BigNumber | undefined> {
    const scheduledPayments = await this.getSchedulePaymentsModule();

    const estimatedGas = await scheduledPayments.estimateGas(
      'create_safe_with_module'
    );

    return estimatedGas.gasRangeInWei.standard;
  }

  async createSafe(): Promise<{ safeAddress: string }> {
    const scheduledPayments = await this.getSchedulePaymentsModule();

    return scheduledPayments.createSafeWithModuleAndGuard(
      undefined,
      undefined,
      this.contractOptions
    );
  }

  async waitForSafeToBeIndexed(
    chainId: number,
    walletAddress: string,
    safeAddress: string
  ): Promise<void> {
    await poll(
      () => this.safes.fetchSafes(chainId, walletAddress),
      (safes: Safe[]) => {
        return !!safes.find((safe: Safe) => safe.address === safeAddress);
      },
      1000,
      2 * 60 * 1000 // Poll for 2 minutes. If the safe is not indexed by then, show an error message
    );
  }

  @action
  async getScheduledPaymentGasEstimation(
    scenario: GasEstimationScenario,
    tokenAddress: ChainAddress,
    gasTokenAddress: ChainAddress
  ): Promise<GasEstimationResult> {
    const scheduledPayments = await this.getSchedulePaymentsModule();

    const gasEstimationResult = await scheduledPayments.estimateGas(
      scenario,
      tokenAddress,
      gasTokenAddress
    );
    const { gasRangeInWei, gasRangeInUSD } = gasEstimationResult;
    const priceWeiInGasToken = String(
      await getNativeWeiInToken(this.wallet.ethersProvider, gasTokenAddress)
    );
    return {
      gas: gasEstimationResult.gas,
      gasRangeInGasTokenWei: {
        normal: gasRangeInWei.standard
          .mul(priceWeiInGasToken)
          .mul(GAS_RANGE_NORMAL_MULTIPLIER),
        high: gasRangeInWei.standard
          .mul(priceWeiInGasToken)
          .mul(GAS_RANGE_HIGH_MULTIPLIER),
        max: gasRangeInWei.standard
          .mul(priceWeiInGasToken)
          .mul(GAS_RANGE_MAX_MULTIPLIER),
      },
      gasRangeInUSD: {
        normal: gasRangeInUSD.standard.mul(GAS_RANGE_NORMAL_MULTIPLIER),
        high: gasRangeInUSD.standard.mul(GAS_RANGE_HIGH_MULTIPLIER),
        max: gasRangeInUSD.standard.mul(GAS_RANGE_MAX_MULTIPLIER),
      },
    };
  }

  @task *schedulePayment(
    safeAddress: ChainAddress,
    moduleAddress: ChainAddress,
    tokenAddress: ChainAddress,
    amount: string,
    payeeAddress: ChainAddress,
    executionGas: number,
    maxGasPrice: string,
    gasTokenAddress: ChainAddress,
    salt: string,
    payAt: number | null,
    recurringDayOfMonth: number | null,
    recurringUntil: number | null,
    onScheduledPaymentIdReady: (scheduledPaymentId: string) => void
  ): TaskGenerator<void> {
    const scheduledPayments = yield this.getSchedulePaymentsModule();
    yield scheduledPayments.schedulePayment(
      safeAddress,
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
      recurringUntil,
      onScheduledPaymentIdReady
    );
    console.log(
      `Scheduled payment added in both crank and on chain successfully.`
    );
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
