import {
  getSDK,
  Web3Provider,
  ScheduledPaymentModule,
} from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

import { BigNumber } from 'ethers';

import { ChainAddress } from '../../../ssr-web/app/utils/web3-strategies/types';

export default class SchedulePaymentSDKService extends Service {
  @service declare wallet: WalletService;

  estimatedSafeCreationGas: undefined | BigNumber;

  private async getSchedulePaymentsModule(): Promise<ScheduledPaymentModule> {
    //@ts-expect-error currentProvider does not match Web3Provider,
    //not worth typing as we should replace the web3 one with ethers soon
    const ethersProvider = new Web3Provider(this.wallet.web3.currentProvider);

    const module = await getSDK('ScheduledPaymentModule', ethersProvider);

    return module;
  }

  private get contractOptions() {
    return { from: this.wallet.address };
  }

  @action async getCreateSafeGasEstimation(): Promise<BigNumber | undefined> {
    const scheduledPayments = await this.getSchedulePaymentsModule();

    const estimatedGas = await scheduledPayments.estimateGas(
      'create_safe_with_module'
    );

    return estimatedGas.gasRangeInWei.standard;
  }

  @task *createSafe(): TaskGenerator<void> {
    const scheduledPayments = yield this.getSchedulePaymentsModule();

    yield scheduledPayments.createSafeWithModuleAndGuard(
      undefined,
      undefined,
      this.contractOptions
    );
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
