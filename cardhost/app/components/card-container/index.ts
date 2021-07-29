import { Card } from './../../services/cards';
import Component from '@glimmer/component';
import { inject } from '@ember/service';
import { action } from '@ember/object';
import ModalService from 'cardhost/services/modal';
import type RouterService from '@ember/routing/router-service';
import { taskFor } from 'ember-concurrency-ts';

interface CardContainerArgs {
  card?: Card;
  editable?: boolean;
}

// TODO: This is hardcoded for now. We need to decide how this should work.
const REALM = 'https://demo.com';
export default class CardContainer extends Component<CardContainerArgs> {
  @inject declare modal: ModalService;
  @inject declare router: RouterService;

  @action createNew(card: Card): void {
    taskFor(this.modal.editCardTask).perform(card, {
      realm: REALM,
      parentCardURL: card.model.url,
    });
  }
}
