import Controller, { inject as controller } from '@ember/controller';
import ApplicationController from '@cardstack/safe-tools-client/controllers/application';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
  @controller declare application: ApplicationController;

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

  get safeButton() {
    if (!this.safe) {
      return {
        label: 'Create Safe',
        modalFlag: 'isSetupSafeModalOpen',
      };
    }

    return {
      label: 'Add Funds',
      modalFlag: 'isDepositModalOpen',
    };
  }
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
