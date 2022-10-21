import Controller, { inject as controller } from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

import ApplicationController from '@cardstack/safe-tools-client/controllers/application';

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

  // TODO: add selected network
  get network() {
    return 'Ethereum';
  }

  get scheduledPaymentsTokensToCover() {
    // TODO: Add helper functions to map amounts, use fromWei function
    return {
      nextMonth: {
        tokens: [
          {
            symbol: 'ETH',
            amountToCover: 0,
          },
          {
            symbol: 'USDC',
            amountToCover: 0,
          },
          {
            symbol: 'USDT',
            amountToCover: 0,
          },
        ],
        hasEnoughBalance: true,
      },
      nextSixMonths: {
        tokens: [
          {
            symbol: 'DAI',
            amountToCover: 0,
          },
        ],
        hasEnoughBalance: true,
      },
    };
  }
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
