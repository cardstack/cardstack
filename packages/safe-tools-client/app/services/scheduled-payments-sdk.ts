import { getSDK, Web3Provider } from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';

import { BigNumber } from 'ethers';

export default class SchedulePaymentSDKService extends Service {
  @service declare wallet: WalletService;

  estimatedSafeCreationGas: undefined | BigNumber;

  private async getSchedulePaymentsModule() {
    const ethersProvider = new Web3Provider(this.wallet.web3.givenProvider);

    const module = await getSDK('ScheduledPaymentModule', ethersProvider);

    return module;
  }

  @action async getCreateSafeGasEstimation(): Promise<BigNumber | undefined> {
    try {
      const scheduledPayments = await this.getSchedulePaymentsModule();

      const estimatedSafeCreationGas =
        await scheduledPayments.createSafeWithModuleAndGuardEstimation();

      return estimatedSafeCreationGas;
    } catch (e) {
      // TODO: handle error
      console.log(e);
    }
    return;
  }

  // TODO convert it to task
  @action async createSafe() {
    try {
      const scheduledPayments = await this.getSchedulePaymentsModule();

      const result = await scheduledPayments.createSafeWithModuleAndGuard();
      console.log({ result });
    } catch (e) {
      // TODO: handle error
      console.log(e);
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
