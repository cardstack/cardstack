import Controller, { inject as controller } from '@ember/controller';
import ApplicationController from '@cardstack/safe-tools-client/controllers/application';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
  @controller declare application: ApplicationController;

  // modified with set helper
  @tracked isSetupSafeModalOpen = false;
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
