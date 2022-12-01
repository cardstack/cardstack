import {
  type GasEstimationScenario,
  type ChainAddress,
  getSDK,
  Web3Provider,
} from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

import { BigNumber } from 'ethers';

import { GasEstimationResult } from '../../../cardpay-sdk/sdk/scheduled-payment-module';

export default class SchedulePaymentSDKService extends Service {
  @service declare wallet: WalletService;

  estimatedSafeCreationGas: undefined | BigNumber;

  private async getSchedulePaymentsModule() {
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

    return gasEstimationResult;
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
