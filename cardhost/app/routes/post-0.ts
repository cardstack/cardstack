import Route from '@ember/routing/route';
import { inject } from '@ember/service';
import CardsService, { LoadedCard } from '../services/cards';

export default class Delegate extends Route {
  @inject declare cards: CardsService;

  model(): Promise<LoadedCard> {
    return this.cards.load('https://demo.com/post-0', 'isolated');
  }
}
