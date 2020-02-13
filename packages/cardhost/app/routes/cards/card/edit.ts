import Route from '@ember/routing/route';
import { Model } from '../card';
import { action } from '@ember/object';
import { set } from '@ember/object';
import { AddressableCard } from '@cardstack/core/card';

export default class CardsCardEdit extends Route {
  @action
  updateCardModel(card: AddressableCard, isDirty: boolean) {
    let model = this.modelFor(this.routeName) as Model;
    set(model, 'isDirty', isDirty);
    set(model, 'card', card);
  }
}
