import {
  type GasEstimationScenario,
  type ChainAddress,
  getSDK,
  ScheduledPaymentModule,
  getNativeWeiInToken,
  poll,
  SchedulePaymentProgressListener,
  getConstant,
} from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import SafesService, {
  Safe,
} from '@cardstack/safe-tools-client/services/safes';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { BigNumber } from 'ethers';

import { SelectableToken } from '../../../boxel/addon/components/boxel/input/selectable-token';

const GAS_RANGE_NORMAL_MULTIPLIER = 2;
const GAS_RANGE_HIGH_MULTIPLIER = 4;
const GAS_RANGE_MAX_MULTIPLIER = 6;

export type ExecutionGasRange = Record<'normal' | 'high' | 'max', BigNumber>;
export interface ExecutionGasEstimationResult {
  gas: BigNumber;
  gasRangeInGasTokenWei: ExecutionGasRange;
  gasRangeInUSD: ExecutionGasRange;
}
export interface ConfiguredScheduledPaymentFees {
  fixedUSD: number | undefined;
  percentage: number | undefined;
}

export default class SchedulePaymentSDKService extends Service {
  @service declare wallet: WalletService;
  @service declare safes: SafesService;

  estimatedSafeCreationGas: undefined | BigNumber;

  private async getSchedulePaymentModule(): Promise<ScheduledPaymentModule> {
    const module = await getSDK(
      'ScheduledPaymentModule',
      this.wallet.ethersProvider
    );

    return module;
  }

  private get contractOptions() {
    return { from: this.wallet.address };
  }

  async getCreateSafeGasEstimation(): Promise<{
    gasEstimateInNativeToken: BigNumber;
    gasEstimateInUsd: BigNumber;
  }> {
    const scheduledPayments = await this.getSchedulePaymentModule();

    const estimatedGas = await scheduledPayments.estimateGas(
      'create_safe_with_module',
      { hubUrl: config.hubUrl }
    );

    return {
      gasEstimateInNativeToken: estimatedGas.gasRangeInWei.standard,
      gasEstimateInUsd: estimatedGas.gasRangeInUSD.standard,
    };
  }

  async createSafe(): Promise<{ safeAddress: string }> {
    const scheduledPayments = await this.getSchedulePaymentModule();

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
    token: SelectableToken,
    gasToken: SelectableToken
  ): Promise<ExecutionGasEstimationResult> {
    const scheduledPayments = await this.getSchedulePaymentModule();

    const gasEstimationResult = await scheduledPayments.estimateGas(scenario, {
      tokenAddress: token.address,
      gasTokenAddress: gasToken.address,
      hubUrl: config.hubUrl,
    });
    const { gasRangeInWei, gasRangeInUSD } = gasEstimationResult;
    const priceWeiInGasToken = String(
      await getNativeWeiInToken(this.wallet.ethersProvider, gasToken.address)
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
    listener: SchedulePaymentProgressListener
  ): TaskGenerator<void> {
    try {
      const scheduledPaymentModule: ScheduledPaymentModule =
        yield this.getSchedulePaymentModule();
      yield scheduledPaymentModule.schedulePayment(
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
        {
          hubUrl: config.hubUrl,
          listener,
        }
      );
    } catch (err) {
      console.error(err);
    }
  }

  async cancelScheduledPayment(
    scheduledPaymentId: string,
    authToken: string
  ): Promise<unknown> {
    const scheduledPaymentModule: ScheduledPaymentModule =
      await this.getSchedulePaymentModule();

    return scheduledPaymentModule.cancelScheduledPayment(
      scheduledPaymentId,
      config.hubUrl,
      authToken
    );
  }

  async getFees(): Promise<ConfiguredScheduledPaymentFees> {
    const [fixedUSD, percentage] = await Promise.all([
      getConstant('scheduledPaymentFeeFixedUSD', this.wallet.ethersProvider),
      getConstant('scheduledPaymentFeePercentage', this.wallet.ethersProvider),
    ]);
    return {
      fixedUSD,
      percentage,
    };
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
