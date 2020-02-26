import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class CardsRoute extends Route {
  @service library;

  async model() {
    await this.library.load.perform();
    return { featuredEntries: this.library.featuredEntries };
  }

  @action
  willTransition() {
    this.library.hide();
  }
}
