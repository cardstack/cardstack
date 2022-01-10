import Route from '@ember/routing/route';
import CardModel from '@cardstack/core/src/card-model';
import { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import CardsService from '../services/cards';

import type Controller from '../controllers/playground';
import type Transition from '@ember/routing/-private/transition';

let cardURL = 'https://demo.com/user-ruth';

export default class MyRoute extends Route {
  @inject declare cards: CardsService;

  @tracked models: CardModel[] | undefined;

  async model(): Promise<CardModel> {
    return await this.cards.load(cardURL, 'embedded');
  }

  setupController(
    controller: Controller,
    model: CardModel,
    transition: Transition
  ): void {
    super.setupController(controller, model, transition);
    controller.selected = model;
  }
}
