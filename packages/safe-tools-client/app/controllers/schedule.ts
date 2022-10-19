import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

import '../css/schedule.css';

export default class Schedule extends Controller {
  // modified with set helper
  @tracked isSetupSafeModalOpen = false;
}

declare module '@ember/controller' {
  interface Registry {
    schedule: Schedule;
  }
}
