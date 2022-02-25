import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';

export default class BoomRoute extends Route {
  @service declare fastboot: Fastboot;

  setupController(controller: Controller, model: any, transition: any) {
    super.setupController(controller, model, transition);

    if (!this.fastboot.isFastBoot) {
      //@ts-expect-error
      raiseAnUnhandledExceptionOnPurpose();
    }
  }
}
