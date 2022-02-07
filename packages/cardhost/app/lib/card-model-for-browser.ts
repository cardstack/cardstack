import {
  JSONAPIDocument,
  SerializerMap,
  Setter,
  Saved,
  Unsaved,
  ResourceObject,
  assertDocumentDataIsResource,
  CardModel,
  RawCardData,
  Format,
  ComponentInfo,
  CardId,
} from '@cardstack/core/src/interfaces';
// import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import { cloneDeep } from 'lodash';
import { tracked as _tracked } from '@glimmer/tracking';
import {
  deserializeAttributes,
  serializeAttributes,
  serializeResource,
} from '@cardstack/core/src/serializers';
import { cardURL } from '@cardstack/core/src/utils';
import { Conflict, isCardstackError } from '@cardstack/core/src/utils/errors';
import { get, set } from '@ember/object';
import Cards from 'cardhost/services/cards';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';
import LocalRealm from './builder';

const { cardServer } = config as any; // Environment types arent working

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  realm: string;
  parentCardURL: string;
  innerComponent: unknown;
  serializerMap: SerializerMap;
}

export interface LoadedState {
  type: 'loaded';
  format: Format;
  url: string;
  serializerMap: SerializerMap;
  rawServerResponse: ResourceObject<Saved>;
  innerComponent: unknown;
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModelForBrowser implements CardModel {
  setters: Setter;
  private declare _data: any;
  private state: CreatedState | LoadedState;
  private wrapperComponent: unknown | undefined;
  private _schemaInstance: any | undefined;

  constructor(
    private cards: Cards,
    state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>,
    private localRealm?: LocalRealm
  ) {
    if (state.type == 'created') {
      this.state = state;
    } else {
      this.state = {
        ...state,
        deserialized: false,
        original: undefined,
      };
    }
    this.setters = this.makeSetter();
    let prop = tracked(this, '_data', {
      enumerable: true,
      writable: true,
      configurable: true,
    });
    if (prop) {
      Object.defineProperty(this, '_data', prop);
    }
  }

  async adoptIntoRealm(realm: string, id?: string): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    if (id) {
      try {
        await this.cards.load(cardURL({ realm, id }), 'isolated');
        throw new Conflict(`Card ${id} already exists in realm ${realm}`);
      } catch (e: any) {
        if (!isCardstackError(e) || e.status !== 404) {
          throw e;
        }
        // we expect a 404 here, so we can continue
      }
    }

    return new (this.constructor as typeof CardModelForBrowser)(
      this.cards,
      {
        type: 'created',
        realm,
        parentCardURL: this.state.url,
        innerComponent: this.innerComponent,
        serializerMap: this.serializerMap,
      },
      this.localRealm
    );
  }

  setData(_data: RawCardData) {
    throw new Error('unimplemented');
  }

  get innerComponent(): unknown {
    return this.state.innerComponent;
  }

  get serializerMap(): SerializerMap {
    return this.state.serializerMap;
  }

  get id(): string {
    return this.url;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(
        `bug: card in state ${this.state.type} does not have a url`
      );
    }
    return this.state.url;
  }

  get format(): Format {
    if (this.state.type === 'created') {
      return 'isolated';
    }
    return this.state.format;
  }

  private get schemaModulePath() {
    if (this.state.type === 'created') {
      return '?'; // TODO: Not sure what to do here yet
    }
    let { schemaModule } = this.state.rawServerResponse.meta || {};
    if (!schemaModule || typeof schemaModule !== 'string') {
      throw new Error(
        'Card server response doesnt include a schemaModule in its meta'
      );
    }
    return schemaModule;
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.load(
      this.state.url,
      'edit'
    )) as CardModelForBrowser;
    (editable.state as LoadedState).original = this;
    return editable;
  }

  get data(): any {
    switch (this.state.type) {
      case 'loaded':
        if (!this.state.deserialized) {
          this._data = deserializeAttributes(
            this.state.rawServerResponse.attributes,
            this.serializerMap
          );
          this.state.deserialized = true;
        }
        return this._data;
      case 'created':
        return this._data;
      default:
        throw assertNever(this.state);
    }
  }

  get component(): unknown {
    if (!this.wrapperComponent) {
      this.wrapperComponent = prepareComponent(this, this.innerComponent);
    }
    return this.wrapperComponent;
  }

  async computeFields() {
    for (const field of this.usedFields) {
      let value = await this.getField(field);
      set(this._data, field, value);
    }
  }

  async getField(name: string): Promise<any> {
    // TODO: add isComputed somewhere in the metadata coming out of the compiler so we can do this optimization
    // if (this.isComputedField(name)) {
    //   return get(this.data, name);
    // }

    // TODO we probably want to cache the schemaInstance. It should only be
    // created the first time it's needed

    // TODO need to deserialize value
    let schemaInstance = await this.schemaInstance();
    return await schemaInstance[name];
  }

  async schemaInstance() {
    if (this._schemaInstance) {
      return this._schemaInstance;
    }
    let SchemaClass = (
      await this.cards.loadModule<{ default: any }>(this.schemaModulePath)
    ).default;
    this._schemaInstance = new SchemaClass((fieldPath: string) =>
      get(this._data, fieldPath)
    );
    return this._schemaInstance;
  }

  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        this._data = value;
        return;
      }
      let data = this._data || {};
      let cursor: any = data;
      for (let segment of innerSegments) {
        let nextCursor = cursor[segment];
        if (!nextCursor) {
          nextCursor = {};
          cursor[segment] = nextCursor;
        }
        cursor = nextCursor;
      }
      cursor[lastSegment] = value;
      this._data = data;
    };
    (s as any).setters = new Proxy(
      {},
      {
        get: (target: any, prop: string, receiver: unknown) => {
          if (typeof prop === 'string') {
            return this.makeSetter([...segments, prop]);
          } else {
            return Reflect.get(target, prop, receiver);
          }
        },
      }
    );

    return s;
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    return serializeResource(
      'card',
      this.state.type === 'loaded' ? this.state.url : undefined,
      serializeAttributes(this.data, this.serializerMap)
    );
  }

  get usedFields(): ComponentInfo['usedFields'] {
    // the server just gives the browser whatever fields are appropriate for the
    // format and the browser just has to accept that
    throw new Error('used fields are not supported in browser');
  }

  async save(): Promise<void> {
    let response: JSONAPIDocument<Saved>;
    let original: CardModel | undefined;

    switch (this.state.type) {
      case 'created':
        if (this.localRealm) {
          response = await this.createLocal();
        } else {
          response = await this.createRemote();
        }
        break;
      case 'loaded':
        original = this.state.original;
        if (this.localRealm) {
          response = await this.updateLocal();
        } else {
          response = await this.updateRemote();
        }
        break;
      default:
        throw assertNever(this.state);
    }

    let { data } = response;
    assertDocumentDataIsResource(data);

    let { serializerMap, innerComponent } = this.state;

    this.state = {
      type: 'loaded',
      format: this.format,
      url: data.id,
      rawServerResponse: cloneDeep(data),
      deserialized: false,
      original,
      serializerMap,
      innerComponent,
    };
  }

  private async createRemote(): Promise<JSONAPIDocument> {
    if (this.state.type !== 'created') {
      throw new Error(
        `cannot createRemote() for card model when state is "${this.state.type}"`
      );
    }
    return await fetchJSON<JSONAPIDocument>(
      buildNewURL(this.state.realm, this.state.parentCardURL),
      {
        method: 'POST',
        body: JSON.stringify({ data: this.serialize() }),
      }
    );
  }

  private async updateRemote(): Promise<JSONAPIDocument> {
    if (this.state.type !== 'loaded') {
      throw new Error(
        `cannot updateRemote() for card model when state is "${this.state.type}"`
      );
    }
    return await fetchJSON<JSONAPIDocument>(buildCardURL(this.url), {
      method: 'PATCH',
      body: JSON.stringify({ data: this.serialize() }),
    });
  }

  private async createLocal(): Promise<JSONAPIDocument> {
    if (this.state.type !== 'created') {
      throw new Error(
        `cannot createLocal() for card model when state is "${this.state.type}"`
      );
    }
    if (!this.localRealm) {
      throw new Error(
        `cannot createLocal() for card model without local realm`
      );
    }
    let resource = this.serialize();
    assertDocumentDataIsResource(resource);
    let data = resource.attributes;
    let id = this.localRealm.generateId();
    this.localRealm.createRawCard({
      realm: this.state.realm,
      id,
      data,
      adoptsFrom: this.state.parentCardURL,
    });
    let url = cardURL({ realm: this.state.realm, id });
    return await this.loadFromLocalRealm(url);
  }

  private async updateLocal(): Promise<JSONAPIDocument> {
    if (this.state.type !== 'loaded') {
      throw new Error(
        `cannot updateLocal() for card model when state is "${this.state.type}"`
      );
    }
    if (!this.localRealm) {
      throw new Error(
        `cannot updateLocal() for card model without local realm`
      );
    }
    let cardId = this.parseLocalRealmURL(this.url);
    if (!cardId) {
      throw new Error(`${this.url} is not in the local realm`);
    }
    let resource = this.serialize();
    assertDocumentDataIsResource(resource);
    let data = resource.attributes;
    let existingRawCard = await this.localRealm.getRawCard(this.url);
    if (!existingRawCard) {
      throw new Error(
        `Tried to update a local card that doesn't exist: ${this.url}`
      );
    }

    existingRawCard.data = data;
    return await this.loadFromLocalRealm(this.url);
  }

  private async loadFromLocalRealm(url: string): Promise<JSONAPIDocument> {
    if (!this.localRealm) {
      throw new Error(
        `cannot loadFromLocalRealm() for card model without local realm`
      );
    }
    let { raw } = await this.localRealm.load(url);
    return {
      data: {
        type: 'card',
        id: url,
        attributes: raw.data,
      },
    };
  }

  private parseLocalRealmURL(url: string): CardId | undefined {
    if (!this.localRealm) {
      return;
    }
    if (url.startsWith(this.localRealm.realmURL)) {
      return {
        realm: this.localRealm.realmURL,
        id: url.slice(this.localRealm.realmURL.length),
      };
    }
    return;
  }
}

export function prepareComponent(
  cardModel: CardModel,
  component: unknown
): unknown {
  return setComponentTemplate(
    hbs`<this.component @model={{this.data}} @set={{this.set}} />`,
    class extends Component {
      component = component;
      get data() {
        return cardModel.data;
      }
      set = cardModel.setters;
    }
  );
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

function tracked(
  target: CardModel,
  prop: string,
  desc: PropertyDescriptor
): PropertyDescriptor | void {
  //@ts-ignore the types for glimmer tracked don't seem to be lining
  return _tracked(target, prop, desc);
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
