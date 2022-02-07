import Route from '@ember/routing/route';
import { inject } from '@ember/service';
import CardsService from '../services/cards';

export default class Delegate extends Route {
  @inject declare cards: CardsService;

  async model(params: { pathname: string; url?: string }) {
    let card = await this.cards.loadForRoute('/' + params.pathname);
    let component = await card.component();
    return {
      card,
      component,
    };
  }
}
