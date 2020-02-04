import Route from '@ember/routing/route';
import { cardDocument } from '@cardstack/core/card-document';
import { inject as service } from '@ember/service';
import DataService from '../../services/data';
import { Card } from '@cardstack/core/card';
import { getUserRealm } from '../../utils/scaffolding';
import { canonicalURLToCardId } from '@cardstack/core/card-id';

export interface RouteParams {
  id_or_title: string;
}

export default class CardsCardV2 extends Route {
  @service data!: DataService;

  model({ id_or_title: idOrTitle }: RouteParams): Promise<Card> {
    // TODO need more rigourous way to tell if we have a card ID or a title
    let cardId = idOrTitle.indexOf('http') === 0 ? canonicalURLToCardId(idOrTitle) : null;
    if (!cardId) {
      return this.data.create(
        getUserRealm(),
        cardDocument().withAttributes({
          csTitle: idOrTitle,
        }).jsonapi
      );
    }
    return this.data.load(cardId, 'everything');
  }

  // TODO just use 'new' as a placeholder when the card is not addressable
  serialize(model: Card): RouteParams {
    let id = model.canonicalURL;
    if (id) {
      return { id_or_title: id }; // eslint-disable-line @typescript-eslint/camelcase
    }
    return { id_or_title: model.csTitle! }; // eslint-disable-line @typescript-eslint/camelcase
  }
}
