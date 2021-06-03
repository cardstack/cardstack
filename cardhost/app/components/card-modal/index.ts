import Component from '@glimmer/component';
import { inject } from '@ember/service';
import CardsService from '../../services/cards';
import { action } from '@ember/object';

export default class CardModal extends Component {
  @inject declare cards: CardsService;

  @action close(): void {
    this.cards.closeModal();
  }
}
