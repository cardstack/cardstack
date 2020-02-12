import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { AddressableCard } from '@cardstack/core/card';

export default class EditCardV2Controller extends Controller {
  @service routeInfo!: { mode: string };

  @action
  updateCard(card: AddressableCard, isDirty: boolean) {
    this.send('updateCardModel', card, isDirty);
  }
}
