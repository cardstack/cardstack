import Controller from '@ember/controller';
import Route from '@ember/routing/route';

export default class BoomRoute extends Route {
  setupController(controller: Controller, model: any, transition: any) {
    super.setupController(controller, model, transition);

    //@ts-ignore intentional error
    raiseAnUnhandledExceptionOnPurpose();
  }
}
