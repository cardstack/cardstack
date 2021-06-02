import Component from '@glimmer/component';
import { inject } from '@ember/service';
import CardsService, { LoadedCard } from '../../services/cards';
import { reads } from 'macro-decorators';
import { action } from '@ember/object';

export default class CardModal extends Component {
  @inject declare cards: CardsService;

  @reads('cards.isShowingModal') showModal: boolean;
  @reads('cards.isLoading') isLoading: boolean;
  @reads('cards.modalModel') model: LoadedCard;

  @action close(): void {
    this.cards.closeModal();
  }
}
