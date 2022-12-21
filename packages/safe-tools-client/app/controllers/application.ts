import Controller from '@ember/controller';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import WalletService from '../services/wallet';

export default class ApplicationController extends Controller {
  @tracked isShowingConnectModal = false;
  @service declare wallet: WalletService;
}

declare module '@ember/controller' {
  interface Registry {
    application: ApplicationController;
  }
}
