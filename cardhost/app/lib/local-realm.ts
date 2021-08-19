import type {
  CardJSONResponse,
  CompiledCard,
  Field,
  Format,
  RawCard,
  Builder,
  CardOperation,
} from '@cardstack/core/src/interfaces';
import { findIncluded } from '@cardstack/core/src/jsonapi';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';
import { Compiler } from '@cardstack/core/src/compiler';
import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import dynamicCardTransform from './dynamic-card-transform';
import { encodeCardURL } from '@cardstack/core/src/utils';
import Cards from 'cardhost/services/cards';

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
  // these are the canonical sources for cards stored in our local realm
  private rawCards = new Map<string, RawCard>();

  // cache of raw cards that we loaded from the server (because we needed them
  // as dependencies)
  private remoteRawCards = new Map<string, RawCard>();

  private compiledCardCache = new Map<string, CompiledCard>();
  private compiler: Compiler;

  private localModules = new Map<string, LocalModule>();

  constructor(private ownRealmURL: string, private cards: Cards) {
    this.compiler = new Compiler({
      builder: this,
    });
  }

  async load(url: string, format: Format): Promise<CardJSONResponse> {
    let raw = await this.getRawCard(url);
    let compiled = await this.getCompiledCard(url);

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

  async createRawCard(rawCard: RawCard): Promise<void> {
    if (this.inOwnRealm(rawCard.url)) {
      this.rawCards.set(rawCard.url, rawCard);
    } else {
      throw new Error('unimplemented');
    }
  }

  async getRawCard(url: string): Promise<RawCard> {
    if (this.inOwnRealm(url)) {
      let card = this.rawCards.get(url);
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
        return this.deserializeRawCard(response.data, response).raw;
      }
    }
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let cached = this.compiledCardCache.get(url);
    if (cached) {
      return cached;
    }

    if (this.inOwnRealm(url)) {
      let rawCard = await this.getRawCard(url);
      let compiledCard = await this.compiler.compile(rawCard);
      this.compiledCardCache.set(url, compiledCard);
      return compiledCard;
    } else {
      let response = await fetchJSON<any>(
        [
          cardServer,
          'sources/',
          encodeURIComponent(url),
          '?include=compiledMeta',
        ].join('')
      );

      let { compiled } = this.deserializeRawCard(response.data, response);
      if (!compiled) {
        throw new Error(`expected to find compiled meta alongside raw card`);
      }
      return compiled;
    }
  }

  async send(op: CardOperation): Promise<CardJSONResponse> {
    throw new Error(`unimplemented localrealm send ${JSON.stringify(op)}`);
  }

  private inOwnRealm(cardURL: string): boolean {
    return cardURL.startsWith(this.ownRealmURL);
  }

  private deserializeRawCard(
    resource: any,
    doc: any
  ): {
    raw: RawCard;
    compiled: CompiledCard | undefined;
  } {
    if (resource.type !== 'raw-cards') {
      throw new Error(`expected type raw-cards, got ${resource.type}`);
    }
    let { attributes: attrs } = resource;
    let raw: RawCard = {
      url: resource.id,
      schema: attrs?.schema,
      isolated: attrs?.isolated,
      embedded: attrs?.embedded,
      edit: attrs?.edit,
      deserializer: attrs?.deserializer,
      adoptsFrom: attrs?.adoptsFrom,
      files: attrs?.files,
      data: attrs?.data,
    };
    this.remoteRawCards.set(raw.url, raw);
    let metaRef = resource.relationships?.compiledMeta?.data;
    let compiled: CompiledCard | undefined;
    if (metaRef) {
      compiled = this.compiledCardCache.get(metaRef.id);
      if (!compiled) {
        let metaResource = findIncluded(doc, metaRef);
        if (metaRef) {
          compiled = this.deserializeCompiledMeta(metaResource, doc);
        }
      }
    }
    return { raw, compiled };
  }

  private deserializeCompiledMeta(resource: any, doc: any): CompiledCard {
    if (resource.type !== 'compiled-metas') {
      throw new Error(`expected type compiled-metas, got ${resource.type}`);
    }
    let { attributes: attrs } = resource;
    let compiled: CompiledCard = {
      url: resource.id,
      schemaModule: attrs?.schemaModule,
      serializer: attrs?.serializer,
      isolated: attrs?.isolated,
      embedded: attrs?.embedded,
      edit: attrs?.edit,
      fields: {},
    };
    this.compiledCardCache.set(compiled.url, compiled);

    let parentRef = resource.relationships?.adoptsFrom?.data;
    if (parentRef) {
      let cached = this.compiledCardCache.get(parentRef.id);
      if (cached) {
        compiled.adoptsFrom = cached;
      } else {
        let parentResource = findIncluded(doc, parentRef);
        if (parentResource) {
          compiled.adoptsFrom = this.deserializeCompiledMeta(
            parentResource,
            doc
          );
        }
      }
    }

    let fieldRefs = resource.relationships?.fields?.data;
    if (fieldRefs) {
      for (let fieldRef of fieldRefs) {
        let fieldResource = findIncluded(doc, fieldRef);
        if (fieldResource) {
          let field = this.deserializeField(fieldRef, doc);
          compiled.fields[field.name] = field;
        }
      }
    }

    return compiled;
  }

  private deserializeField(resource: any, doc: any): Field {
    if (resource.type !== 'fields') {
      throw new Error(`expected type fields, got ${resource.type}`);
    }
    let card = undefined;
    let cardRef = resource.relationships?.card.data;
    if (cardRef) {
      card = this.compiledCardCache.get(cardRef.id);
      if (!card) {
        let cardResource = findIncluded(doc, cardRef);
        if (cardResource) {
          card = this.deserializeCompiledMeta(cardResource, doc);
        }
      }
    }
    if (!card) {
      throw new Error(`bug: field ${resource.id} is missing card relationship`);
    }
    let { attributes: attrs } = resource;
    let field: Field = {
      name: attrs?.name,
      type: attrs?.fieldType,
      card,
    };
    return field;
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

  async define(
    cardURL: string,
    localModule: string,
    type: string,
    source: string
  ): Promise<string> {
    let moduleIdentifier = `@cardstack/local-realm-compiled/${encodeCardURL(
      cardURL
    )}/${localModule}`;

    // this local is here for the evals to see
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let define = this.registerModule.bind(this);

    switch (type) {
      case JS_TYPE: {
        eval(dynamicCardTransform(moduleIdentifier, source));
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
