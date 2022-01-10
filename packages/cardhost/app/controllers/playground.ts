import CardModel from '@cardstack/core/src/card-model';
import Controller from '@ember/controller';
import { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import CardsService from '../services/cards';
import { action } from '@ember/object';

export default class PlaygroundController extends Controller {
  @inject declare cards: CardsService;

  @tracked selected: CardModel | undefined;

  @task async queryUsersTask(): Promise<CardModel[]> {
    return await this.cards.query({
      filter: { type: 'https://demo.com/user' },
    });
  }

  @action onChange(card: CardModel) {
    this.selected = card;
  }
}
