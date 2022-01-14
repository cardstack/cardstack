import { CardModel } from '@cardstack/core/src/interfaces';
import Controller from '@ember/controller';
import { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import CardsService from '../services/cards';

export default class ApplicationController extends Controller {
  @inject declare cards: CardsService;

  @tracked models: CardModel[] | undefined;

  @task async queryUsersTask(): Promise<void> {
    this.models = await this.cards.query({
      filter: { type: 'https://demo.com/user' },
    });
  }
}
