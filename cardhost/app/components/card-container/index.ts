import { LoadedCard } from './../../services/cards';
import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';
import { action, set } from '@ember/object';

interface CardContainerArgs {
  card: LoadedCard;
  editable: boolean;
}

export default class CardContainer extends Component<CardContainerArgs> {
  @inject declare modal: ModalService;

  get cardURL(): string {
    return this.args.card.data.id;
  }

  @action async editCard(): Promise<void> {
    let { data } = this.args.card;
    let newData = await this.modal.openWithCard.perform(this.cardURL, 'edit');
    // TODO: THIS IS GROSSSS
    for (const key in newData) {
      set(data, key, newData[key]);
    }
  }
}
