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
    // TODO: Remove once sdk starts working with dapp
    // return new Promise((resolve) => {
    //   setTimeout(() => {
    //     console.log('Create safe');
    //     resolve(BigNumber.from('100000000000000000'));
    //   }, 2000);
    // });

    const scheduledPayments = await this.getSchedulePaymentsModule();

    const estimatedSafeCreationGas =
      await scheduledPayments.createSafeWithModuleAndGuardEstimation();

    return estimatedSafeCreationGas;
  }

  // TODO: convert it to task
  @action async createSafe() {
    const scheduledPayments = await this.getSchedulePaymentsModule();

    await scheduledPayments.createSafeWithModuleAndGuard();
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
