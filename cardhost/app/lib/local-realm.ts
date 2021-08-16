import type {
  CardJSONResponse,
  Format,
  RawCard,
} from '@cardstack/core/src/interfaces';
import Builder from './builder';

export default class LocalRealm {
  private cards = new Map<string, RawCard>();
  builder = new Builder({ rawCardCache: this.cacheShim() });

  store(card: RawCard) {
    this.cards.set(card.url, card);
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
    let card = this.cards.get(url);
    if (!card) {
      throw new Error(`${url} not found in local realm`);
    }
    return card;
  }

  // TODO: refactor so we have a clearer way to hook into Builder and there's no
  // more need for `interface Cache`. Once we drop mirage I think it will be
  // "easy".
  private cacheShim() {
    return {
      get: (url: string): RawCard | undefined => {
        return this.cards.get(url);
      },
      set: (url: string, payload: RawCard): void => {
        this.cards.set(url, payload);
      },
      update: (url: string, payload: RawCard): void => {
        this.cards.set(url, payload);
      },
      delete: (url: string): void => {
        this.cards.delete(url);
      },
    };
  }
}
