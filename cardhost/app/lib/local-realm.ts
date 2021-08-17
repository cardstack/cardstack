import type {
  CardJSONResponse,
  Format,
  RawCard,
} from '@cardstack/core/src/interfaces';
import Cards from 'cardhost/services/cards';
import Builder from './builder';

export default class LocalRealm {
  private rawCards = new Map<string, RawCard>();
  private builder: Builder;

  constructor(cards: Cards, ownRealmURL: string) {
    this.builder = new Builder(cards, ownRealmURL);
  }

  store(card: RawCard) {
    this.rawCards.set(card.url, card);
  }

  async load(url: string, format: Format): Promise<CardJSONResponse> {
    let raw = await this.builder.getRawCard(url);
    let compiled = await this.builder.getCompiledCard(url);

    // TODO: reduce data shape for the given format like we do on the server
    return {
      data: {
        type: 'card',
        id: url,
        attributes: raw.data, // TODO: I'm assuming everything in here is only attributes
        meta: {
          componentModule: compiled[format].moduleName,
        },
      },
    };
  }

  loadRaw(url: string): RawCard {
    let card = this.rawCards.get(url);
    if (!card) {
      throw new Error(`${url} not found in local realm`);
    }
    return card;
  }
}
