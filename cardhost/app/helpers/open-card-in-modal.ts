import { Format } from '@cardstack/core/src/interfaces';
import Helper from '@ember/component/helper';
import { inject } from '@ember/service';
import CardsService from '../services/cards';

export default class OpenCardInModal extends Helper {
  @inject declare cards: CardsService;

  compute(params: string[], option: { format: Format }): () => void {
    let [cardURL] = params;
    let { format } = option;

    return () => {
      this.cards.loadInModal(cardURL, format);
    };
  }
}
