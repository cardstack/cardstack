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
    return this.args.card.model.url;
  }

  @action async editCard(): Promise<void> {
    let data = this.args.card.model.data;
    let model = await this.modal.openWithCard.perform(this.cardURL, 'edit');
    // TODO: THIS IS GROSSSS. Why does this even work?
    for (const key in model.data) {
      set(data, key, model.data[key]);
    }
  }
}
