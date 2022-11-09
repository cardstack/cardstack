import ApplicationController from '@cardstack/safe-tools-client/controllers/application';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import Controller, { inject as controller } from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
  @controller declare application: ApplicationController;
  @service declare wallet: WalletService;
  @service declare network: NetworkService;

  // modified with set helper
  @tracked isSetupSafeModalOpen = false;
  @tracked isDepositModalOpen = false;

  get safe() {
    //TODO: get safe info from sdk and format it,
    return {
      address: '0x8a40AFffb53f4F953a204cAE087219A28771df9d',
      tokens: [
        {
          address: 'eth',
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          balance: 1, //in ETH
        },
        {
          address: '0x6B...1d0F', // TODO: check when address is hex, to truncate on template
          name: 'Dai',
          symbol: 'DAI',
          decimals: 18,
          balance: 1,
        },
        {
          address: 'usdc',
          name: 'USDC',
          symbol: 'USDC',
          decimals: 6,
          balance: 0,
        },
      ],
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

  get scheduledPaymentsTokensToCover() {
    const hasScheduledPayments = false;
    // TODO: Add helper functions to map amounts, use fromWei function
    return hasScheduledPayments
      ? {
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
        }
      : undefined;
  }
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
