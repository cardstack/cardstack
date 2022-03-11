import {
  CompiledCard,
  Format,
  RawCard,
  Builder,
  CardId,
  CardModel,
  Card,
  assertDocumentDataIsResource,
  ResourceObject,
  Saved,
  CardModelArgs,
} from '@cardstack/core/src/interfaces';
import type { types as t } from '@babel/core';
import { RawCardDeserializer } from '@cardstack/core/src/serializers';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';
import {
  Compiler,
  makeGloballyAddressable,
} from '@cardstack/core/src/compiler';
import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import dynamicCardTransform from './dynamic-card-transform';
import { cardURL, encodeCardURL } from '@cardstack/core/src/utils';
import Cards from 'cardhost/services/cards';
import CardModelForBrowser from './card-model-for-browser';

export const LOCAL_REALM = 'https://cardstack.local/';
export const DEMO_REALM = 'https://demo.com/';

const { cardServer } = config as any; // Environment types arent working

type RegisteredLocalModule = {
  state: 'registered';
  dependencyList: string[];
  implementation: Function;
};

type LocalModule =
  | RegisteredLocalModule
  | {
      state: 'preparing';
      implementation: Function;
      moduleInstance: object;
    }
  | {
      state: 'evaluated';
      moduleInstance: object;
    }
  | {
      state: 'broken';
      exception: any;
    };

// this might want to get renamed to something more generic like "Editor" or
// "Creator" because it encompasses all API for manipulating cards at the source
// code level, whether or not you're storing them in an in-browser local realm.
export default class LocalRealm implements Builder {
  // these are the canonical sources for cards stored in our local realm, key is card id
  private rawCards = new Map<string, RawCard>();

  // cache of raw cards that we loaded from the server (because we needed them
  // as dependencies)
  private remoteRawCards = new Map<string, RawCard>();

  private compiledCardCache = new Map<string, CompiledCard>();
  private localModules = new Map<string, LocalModule>();
  private deserializer = new RawCardDeserializer();

  constructor(
    private ownRealmURL: string,
    private cards: Cards,
    private saveModel: CardModelArgs['saveModel']
  ) {
    if (!ownRealmURL.endsWith('/')) {
      throw new Error(`realm URLs must have trailing slash`);
    }
  }

  get realmURL(): string {
    return this.ownRealmURL;
  }

  async load(url: string): Promise<Card> {
    let compiled = await this.getCompiledCard(url);
    let raw = await this.getRawCard(url);
    return { compiled, raw };
  }

  async loadData(
    url: string,
    format: Format,
    allFields = false
  ): Promise<CardModel> {
    let { compiled, raw } = await this.load(url);

    let model = new CardModelForBrowser(
      this.cards,
      {
        type: 'loaded',
        url,
        allFields,
      },
      {
        format,
        realm: this.realmURL,
        rawData: raw.data ?? {},
        schemaModuleRef: compiled.schemaModule.global,
        componentModuleRef:
          compiled.componentInfos[format].componentModule.global,
        saveModel: this.saveModel,
      }
    );
    await model.recompute();
    return model;
  }

  async loadForRoute(
    routeCardURL: string,
    pathname: string
  ): Promise<CardModel> {
    let routeCard = await this.getCompiledCard(routeCardURL);
    let routeCardClass = (
      await this.cards.loadModule<any>(routeCard.schemaModule.global)
    ).default;
    let routableCardURL = new routeCardClass().routeTo(pathname);
    if (!routableCardURL) {
      throw new Error(`Could not find routable card: ${routableCardURL}`);
    }
    return await this.cards.loadModel(routableCardURL, 'isolated');
  }

  async createRawCard(rawCard: RawCard): Promise<void> {
    if (this.inOwnRealm(rawCard)) {
      this.rawCards.set(rawCard.id, rawCard);
    } else {
      throw new Error('unimplemented');
    }
  }

  async getRawCard(url: string): Promise<RawCard> {
    let cardId = this.parseOwnRealmURL(url);
    if (cardId) {
      let card = this.rawCards.get(cardId.id);
      if (!card) {
        throw new Error(`${url} not found in local realm`);
      }
      return card;
    } else {
      let cached = this.remoteRawCards.get(url);
      if (cached) {
        return cached;
      } else {
        let response = await fetchJSON<any>(
          [cardServer, 'sources/', encodeURIComponent(url)].join('')
        );

        let raw = this.deserializer.deserialize(response.data, response).raw;
        this.remoteRawCards.set(url, raw);
        return raw;
      }
    }
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let cached = this.compiledCardCache.get(url);
    if (cached) {
      return cached;
    }

    let cardId = this.parseOwnRealmURL(url);
    if (cardId) {
      let rawCard = await this.getRawCard(url);
      let compiler = new Compiler({
        builder: this,
        cardSource: rawCard,
      });
      let compiledCard = await compiler.compile();
      let definedCard = makeGloballyAddressable(
        url,
        compiledCard,
        (local, type, src, ast) => this.define(url, local, type, src, ast)
      );
      this.compiledCardCache.set(url, definedCard);
      return definedCard;
    } else {
      let response = await fetchJSON<any>(
        [
          cardServer,
          'sources/',
          encodeURIComponent(url),
          '?include=compiledMeta',
        ].join('')
      );

      let { compiled, raw } = this.deserializer.deserialize(
        response.data,
        response
      );
      if (!compiled) {
        throw new Error(`expected to find compiled meta alongside raw card`);
      }
      this.remoteRawCards.set(url, raw);
      return compiled;
    }
  }

  async create(card: CardModel): Promise<ResourceObject<Saved>> {
    let resource = card.serialize();
    assertDocumentDataIsResource(resource);
    let data = resource.attributes;
    let id = resource.id
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.parseOwnRealmURL(resource.id)!.id
      : this.generateId();
    this.createRawCard({
      realm: this.realmURL,
      id,
      data,
      adoptsFrom: card.parentCardURL,
    });
    let url = cardURL({ realm: this.realmURL, id });
    let { raw } = await this.load(url);
    return {
      type: 'card',
      id: url,
      attributes: raw.data,
    };
  }

  async update(card: CardModel): Promise<ResourceObject<Saved>> {
    let { url } = card;
    let cardId = this.parseOwnRealmURL(url);
    if (!cardId) {
      throw new Error(`${url} is not in the local realm`);
    }
    let resource = card.serialize();
    assertDocumentDataIsResource(resource);
    let data = resource.attributes;
    let existingRawCard = await this.getRawCard(url);
    if (!existingRawCard) {
      throw new Error(
        `Tried to update a local card that doesn't exist: ${url}`
      );
    }

    existingRawCard.data = data;
    let { raw } = await this.load(url);
    return {
      type: 'card',
      id: url,
      attributes: raw.data,
    };
  }

  generateId(): string {
    let id;
    while (!id) {
      let possibleId = String(Math.floor(Math.random() * 10000));
      if (!this.rawCards.has(possibleId)) {
        id = possibleId;
      }
    }
    return id;
  }

  private inOwnRealm(card: RawCard): boolean {
    return card.realm === this.ownRealmURL;
  }

  private parseOwnRealmURL(url: string): CardId | undefined {
    if (url.startsWith(this.ownRealmURL)) {
      return {
        realm: this.ownRealmURL,
        id: url.slice(this.ownRealmURL.length),
      };
    }
    return undefined;
  }

  private async evaluateModule<T extends object>(
    moduleIdentifier: string,
    module: RegisteredLocalModule
  ): Promise<T> {
    let moduleInstance = Object.create(null);
    this.localModules.set(moduleIdentifier, {
      state: 'preparing',
      implementation: module.implementation,
      moduleInstance,
    });
    try {
      let dependencies = await Promise.all(
        module.dependencyList.map((dependencyIdentifier) => {
          if (dependencyIdentifier === 'exports') {
            return moduleInstance;
          } else {
            let absIdentifier = resolveModuleIdentifier(
              dependencyIdentifier,
              moduleIdentifier
            );
            return this.cards.loadModule(absIdentifier);
          }
        })
      );
      module.implementation(...dependencies);
      this.localModules.set(moduleIdentifier, {
        state: 'evaluated',
        moduleInstance,
      });
      return moduleInstance;
    } catch (exception) {
      this.localModules.set(moduleIdentifier, {
        state: 'broken',
        exception,
      });
      throw exception;
    }
  }

  async loadModule<T extends object>(moduleIdentifier: string): Promise<T> {
    let module = this.localModules.get(moduleIdentifier);
    if (!module) {
      throw new Error(`missing local module ${moduleIdentifier}`);
    }
    switch (module.state) {
      case 'preparing':
      case 'evaluated':
        return module.moduleInstance as T;
      case 'broken':
        throw module.exception;
      case 'registered':
        return await this.evaluateModule(moduleIdentifier, module);
      default:
        throw assertNever(module);
    }
  }

  private define(
    cardURL: string,
    localModule: string,
    type: string,
    source: string,
    ast: t.File | undefined
  ): string {
    let moduleIdentifier = `@cardstack/local-realm-compiled/${encodeCardURL(
      cardURL
    )}/${localModule}`;

    // this local is here for the evals to see
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let define = this.registerModule.bind(this);

    switch (type) {
      case JS_TYPE: {
        eval(dynamicCardTransform(moduleIdentifier, source, ast));
        return moduleIdentifier;
      }
      case CSS_TYPE:
        eval(`
          define('${moduleIdentifier}', [], function(){
            const style = document.createElement('style');
            style.innerHTML = \`${source}\`;
            style.setAttribute('data-asset-url', '${moduleIdentifier}');
            document.head.appendChild(style);
          })
        `);
        return moduleIdentifier;
      default:
        return moduleIdentifier;
    }
  }

  private registerModule(
    moduleIdentifier: string,
    dependencyList: string[],
    implementation: Function
  ): void {
    this.localModules.set(moduleIdentifier, {
      state: 'registered',
      dependencyList,
      implementation,
    });
  }
}

function resolveModuleIdentifier(
  moduleIdentifier: string,
  requester: string
): string {
  if (!moduleIdentifier.startsWith('.')) {
    return moduleIdentifier;
  }
  return new URL(
    moduleIdentifier,
    'http://imaginary-origin/' + requester
  ).pathname.slice(1);
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
