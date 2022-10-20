import Controller, { inject as controller } from '@ember/controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

import ApplicationController from '@cardstack/safe-tools-client/controllers/application';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

import '../css/schedule.css';

export default class Schedule extends Controller {
  @controller declare application: ApplicationController;
  @service declare wallet: WalletService;

  // modified with set helper
  @tracked isSetupSafeModalOpen = false;
  @tracked isDepositModalOpen = false;

  get safe() {
    // Should we grab the network nativeToken info here, or expect the sdk method to return it within safeInfo?

    //TODO: get safe info from sdk and format it
    return {
      address: '0xABCD...EFFF',
      token: {
        address: 'eth',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        balance: 0,
      },
    };
  }

  get safeButtonLabel() {
    return this.safe ? 'Add Funds' : 'Create Safe';
  }

  @action onSafeButtonClick() {
    if (this.safe) {
      this.isDepositModalOpen = true;
    } else {
      this.isSetupSafeModalOpen = true;
    }
  }
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
