import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

const baseCardId = 'local-hub::@cardstack/base-card';

export default class AdoptedFromComponent extends Component {
  @service data;

  @action
  removeAdoptedCard() {
    this.adoptFromBaseCard.perform();
  }

  @task(function*() {
    let baseCard;

    try {
      baseCard = yield this.data.getCard(baseCardId, 'isolated');
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      return;
    }

    this.args.adoptedCard.setAdoptedFrom(baseCard);
  })
  adoptFromBaseCard;
}
