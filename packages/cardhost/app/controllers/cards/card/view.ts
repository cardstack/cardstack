import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { CardstackSession } from '../../../services/cardstack-session';
import RouterService from '@ember/routing/router-service';

export default class ViewCardController extends Controller {
  @service router!: RouterService;
  @service cardstackSession!: CardstackSession;

  get isVerifiRealm() {
    let card = this.model.card;
    if (!card) {
      return false;
    }

    if (card.meta && card.meta.cardDir && card.meta.cardDir.includes('fuga-v2-cards')) {
      return true;
    }

    return card.csRealm.includes('verifi');
  }
}
