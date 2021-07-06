import { Card } from './../../services/cards';
import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';

interface CardContainerArgs {
  card: Card;
  editable: boolean;
}

export default class CardContainer extends Component<CardContainerArgs> {
  @inject declare modal: ModalService;
}
