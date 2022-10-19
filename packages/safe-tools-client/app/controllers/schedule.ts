import Controller, { inject as controller } from '@ember/controller';
import ApplicationController from '@cardstack/safe-tools-client/controllers/application';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
  @controller declare application: ApplicationController;

  @tracked isSetupSafeModalOpen = false;

  @action openSetupSafeModal() {
    this.isSetupSafeModalOpen = true;
  }

  @action closeSetupSafeModal() {
    this.isSetupSafeModalOpen = false;
  }
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
