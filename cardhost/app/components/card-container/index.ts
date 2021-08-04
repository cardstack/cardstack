import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';
import type RouterService from '@ember/routing/router-service';
import CardModel from 'cardhost/lib/card-model';

interface CardContainerArgs {
  card?: CardModel;
  editable?: boolean;
}

export default class CardContainer extends Component<CardContainerArgs> {
  @inject declare modal: ModalService;
  @inject declare router: RouterService;

  // TODO: This is hardcoded for now. We need to decide how this should work.
  REALM = 'https://demo.com';
}
