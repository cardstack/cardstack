import ApplicationController from '@cardstack/safe-tools-client/controllers/application';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import SafesService from '@cardstack/safe-tools-client/services/safes';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import Controller, { inject as controller } from '@ember/controller';

import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
  @controller declare application: ApplicationController;
  @service declare wallet: WalletService;
  @service declare network: NetworkService;
  @service declare tokens: TokensService;
  @service declare safes: SafesService;

  @tracked isDepositModalOpen = false;

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
