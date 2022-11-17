import { getSDK, Web3Provider } from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

import { BigNumber } from 'ethers';

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

    const estimatedSafeCreationGas =
      await scheduledPayments.createSafeWithModuleAndGuardEstimation(
        this.contractOptions
      );

    return estimatedSafeCreationGas;
  }

  @task *createSafe(): TaskGenerator<void> {
    const scheduledPayments = yield this.getSchedulePaymentsModule();

    yield scheduledPayments.createSafeWithModuleAndGuard(
      undefined,
      undefined,
      this.contractOptions
    );
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
