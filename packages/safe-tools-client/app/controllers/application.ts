import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class ApplicationController extends Controller {
  @tracked isShowingConnectModal = false;
}

declare module '@ember/controller' {
  interface Registry {
    application: ApplicationController;
  }
}
