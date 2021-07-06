import Route from '@ember/routing/route';
import { inject } from '@ember/service';
import CardsService, { Card } from '../services/cards';

export default class Delegate extends Route {
  @inject declare cards: CardsService;

  model(): Promise<Card> {
    return this.cards.load('https://demo.com/post-0', 'isolated');
  }
}
