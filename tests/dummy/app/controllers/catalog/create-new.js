import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class CatalogCreateNewController extends Controller {
  @action create({ ...attributes }) {
    let newEvent = this.store.createRecord('event', {
      id: this.model.events.length,
      ...attributes
    });

    newEvent.save();

    this.transitionToRoute('catalog.events');
  }

  @action displayDetails({ id }) {
    this.transitionToRoute('catalog.preview', id);
  }
}
