import Service from '@ember/service';

import {
  Format,
  JSONAPIDocument,
  Query,
  ResourceObject,
  CardModel,
  assertDocumentDataIsResource,
  assertDocumentDataIsCollection,
  CardComponentModule,
  CardService,
  Card,
  RawCard,
  Unsaved,
  Saved,
} from '@cardstack/core/src/interfaces';
import config from 'cardhost/config/environment';

import type Builder from 'cardhost/lib/builder';
import { fetchJSON } from 'cardhost/lib/jsonapi-fetch';
import { LOCAL_REALM } from 'cardhost/lib/builder';

import { buildQueryString } from '@cardstack/core/src/query';
import CardModelForBrowser from 'cardhost/lib/card-model-for-browser';
import { cloneDeep } from 'lodash';

const { cardServer } = config as any; // Environment types arent working

export default class Cards extends Service implements CardService {
  private localRealmURL = LOCAL_REALM;
  overrideRoutingCardWith: string | undefined;

  async load(_cardURL: string): Promise<Card> {
    throw new Error('unimplemented');
  }

  async loadData(
    url: string,
    format: Format,
    allFields = false
  ): Promise<CardModel> {
    if (this.inLocalRealm(url)) {
      let builder = await this.builder();
      let model = await builder.loadData(url, format);
      await model.component();
      return model;
    }
    let serverResponse = await fetchJSON<JSONAPIDocument>(
      this.buildCardURL({ url, query: { format } })
    );

    let { data } = serverResponse;
    assertDocumentDataIsResource(data);

    return this.makeCardModelFromResponse(
      data,
      await this.codeForCard(data),
      format
    );
  }

  async loadForRoute(pathname: string): Promise<CardModel> {
    if (this.overrideRoutingCardWith) {
      let builder = await this.builder();
      return await builder.loadForRoute(this.overrideRoutingCardWith, pathname);
    } else {
      let url = `${cardServer}cardFor${pathname}`;
      let cardResponse = await fetchJSON<JSONAPIDocument>(url);
      let { data } = cardResponse;
      assertDocumentDataIsResource(data);
      return this.makeCardModelFromResponse(
        data,
        await this.codeForCard(data),
        'isolated'
      );
    }
  }

  async query(format: Format, query: Query): Promise<CardModel[]> {
    // if (this.inLocalRealm(url)) {
    //   let builder = await this.builder();
    //   cardResponse = await builder.load(url, format);
    // } else {
    let { data } = await fetchJSON<JSONAPIDocument>(
      this.buildCardURL({ query })
    );
    assertDocumentDataIsCollection(data);

    return await Promise.all(
      data.map(async (cardResponse) => {
        return this.makeCardModelFromResponse(
          cardResponse,
          await this.codeForCard(cardResponse),
          format
        );
      })
    );
  }
  async create(_raw: RawCard<Unsaved>): Promise<Card> {
    throw new Error('unimplemented');
  }
  async update(_partialRaw: RawCard): Promise<Card> {
    throw new Error('unimplemented');
  }

  async delete(_raw: RawCard): Promise<void> {
    throw new Error('unimplemented');
  }

  async createModel(card: CardModel): Promise<JSONAPIDocument> {
    let response: JSONAPIDocument;
    if (this.inLocalRealm(card.realm)) {
      let builder = await this.builder();
      response = await builder.create(card.parentCardURL, card.serialize());
    } else {
      response = await this.createRemote(card);
    }
    return response;
  }

  async updateModel(card: CardModel): Promise<JSONAPIDocument> {
    let response: JSONAPIDocument;
    if (this.inLocalRealm(card.realm)) {
      let builder = await this.builder();
      response = await builder.update(
        card.url,
        card.serialize() as ResourceObject<Saved> // loaded state is always saved
      );
    } else {
      response = await this.updateRemote(card);
    }
    return response;
  }

  private async makeCardModelFromResponse(
    cardResponse: ResourceObject,
    componentModule: CardComponentModule,
    format: Format
  ): Promise<CardModel> {
    let schemaModule = cardResponse.meta?.schemaModule;
    if (!schemaModule) {
      throw new Error(
        `card payload for ${cardResponse.id} has no meta.schemaModule`
      );
    }
    if (typeof schemaModule !== 'string') {
      throw new Error(
        `card payload for ${cardResponse.id} meta.schemaModule is not a string`
      );
    }
    let segments = cardResponse.id.split('/');
    segments.pop(); // this is not ideal, maybe we can include the realm in our card payload?
    let realm = segments.join('/');
    if (!realm) {
      throw new Error(`card payload for ${cardResponse.id} has no realm`);
    }
    let model = new CardModelForBrowser(
      this,
      {
        type: 'loaded',
        url: cardResponse.id,
      },
      {
        format,
        realm: realm as string,
        schemaModule,
        rawData: cloneDeep(cardResponse),
        componentModule,
      }
    );

    await model.computeData();
    return model;
  }

  private async createRemote(card: CardModel): Promise<JSONAPIDocument> {
    return await fetchJSON<JSONAPIDocument>(
      buildNewURL(card.realm, card.parentCardURL),
      {
        method: 'POST',
        body: JSON.stringify({ data: card.serialize() }),
      }
    );
  }

  private async updateRemote(card: CardModel): Promise<JSONAPIDocument> {
    return await fetchJSON<JSONAPIDocument>(buildCardURL(card.url), {
      method: 'PATCH',
      body: JSON.stringify({ data: card.serialize() }),
    });
  }

  private inLocalRealm(cardURL: string): boolean {
    return cardURL.startsWith(this.localRealmURL);
  }

  private _builderPromise: Promise<Builder> | undefined;

  async builder(): Promise<Builder> {
    if (this._builderPromise) {
      return this._builderPromise;
    }
    let resolve: any, reject: any;
    this._builderPromise = new Promise((r, e) => {
      resolve = r;
      reject = e;
    });
    try {
      let { default: Builder } = await import('../lib/builder');
      let builder = new Builder(this.localRealmURL, this);
      resolve(builder);
      return builder;
    } catch (err) {
      reject(err);
      throw err;
    }
  }

  private buildCardURL(
    opts: { url?: string; query?: Query & { format?: Format } } = {}
  ): string {
    let fullURL = [cardServer, 'cards/'];
    if (opts.url) {
      fullURL.push(encodeURIComponent(opts.url));
    }
    if (opts.query) {
      fullURL.push(buildQueryString(opts.query));
    }
    return fullURL.join('');
  }

  private async codeForCard(
    card: ResourceObject
  ): Promise<CardComponentModule> {
    let { componentModule } = card.meta || {};
    if (!componentModule || typeof componentModule !== 'string') {
      throw new Error('Cards component module must be present and a string');
    }

    return await this.loadModule<CardComponentModule>(componentModule);
  }

  async loadModule<T extends object>(moduleIdentifier: string): Promise<T> {
    if (moduleIdentifier.startsWith('@cardstack/compiled/')) {
      // module was built by webpack, use webpack's implementation of `await
      // import()`
      moduleIdentifier = moduleIdentifier.replace('@cardstack/compiled/', '');
      return await import(`@cardstack/compiled/${moduleIdentifier}`);
    } else if (moduleIdentifier.startsWith('@cardstack/core/src/')) {
      // module was built by webpack, use webpack's implementation of `await
      // import()`
      moduleIdentifier = moduleIdentifier.replace('@cardstack/core/src/', '');

      // the webpackInclude is necessary because sometimes @cardstack/core has
      // already been pre-built (for consumption in node) and has .js, .d.ts,
      // and .js.map files on disk, all of which would potentially match this
      // wildcard import. We want the .ts only, because that is what embroider
      // with ember-cli-typescript prioritizes in every other import from core.
      return await import(
        /* webpackInclude: /(?<!\.d)\.ts$/ */
        `@cardstack/core/src/${moduleIdentifier}`
      );
    } else if (moduleIdentifier.startsWith('@cardstack/boxel/')) {
      // module was built by webpack, use webpack's implementation of `await
      // import()`
      moduleIdentifier = moduleIdentifier.replace('@cardstack/boxel/', '');
      return await import(
        /* webpackInclude: /\.(js|hbs)$/ */
        `@cardstack/boxel/${moduleIdentifier}`
      );
    } else if (
      moduleIdentifier.startsWith('@cardstack/local-realm-compiled/')
    ) {
      // module was built by our Builder, so ask Builder for it
      let builder = await this.builder();
      return await builder.loadModule(moduleIdentifier);
    } else {
      throw new Error(
        `don't know how to load compiled card code for ${moduleIdentifier}`
      );
    }
  }
}

function buildNewURL(realm: string, parentCardURL: string): string {
  return [
    cardServer,
    'cards/',
    encodeURIComponent(realm) + '/',
    encodeURIComponent(parentCardURL),
  ].join('');
}

function buildCardURL(url: string): string {
  return `${cardServer}cards/${encodeURIComponent(url)}`;
}

declare module '@ember/service' {
  interface Registry {
    cards: Cards;
  }
}
