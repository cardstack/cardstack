import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
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
