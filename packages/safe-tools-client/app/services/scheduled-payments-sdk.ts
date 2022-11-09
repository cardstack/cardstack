import { getSDK, Web3Provider } from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';

import { BigNumber } from 'ethers';

export default class SchedulePaymentSDKService extends Service {
  @service declare wallet: WalletService;

  estimatedSafeCreationGas: undefined | BigNumber;

  //  add reusable method;
  @action async getCreateSafeGasEstimation() {
    const ethersProvider = new Web3Provider(this.wallet.web3.givenProvider);
    // is there a way to reuse this ?
    const scheduledPayments = await getSDK(
      'ScheduledPaymentModule',
      ethersProvider
    );

    this.estimatedSafeCreationGas =
      await scheduledPayments.createSafeWithModuleAndGuardEstimation();
  }
  @action async createSafe() {
    try {
      const ethersProvider = new Web3Provider(this.wallet.web3.givenProvider);
      // is there a way to reuse this ?
      const scheduledPayments = await getSDK(
        'ScheduledPaymentModule',
        ethersProvider
      );

      const result = await scheduledPayments.createSafeWithModuleAndGuard();
      console.log({ result });
    } catch (e) {
      console.log(e);
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    scheduledPaymentsSdk: SchedulePaymentSDKService;
  }
}
