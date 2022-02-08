import {
  JSONAPIDocument,
  Setter,
  Saved,
  Unsaved,
  ResourceObject,
  assertDocumentDataIsResource,
  CardModel,
  RawCardData,
  Format,
  ComponentInfo,
  CardComponentModule,
  CardSchemaModule,
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
import set from 'lodash/set';
import get from 'lodash/get';
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
  componentModule: CardComponentModule;
  schemaModuleId: string;
  format: Format;
}

export interface LoadedState {
  type: 'loaded';
  format: Format;
  url: string;
  rawServerResponse: ResourceObject<Saved>;
  componentModule: CardComponentModule;
  schemaModuleId: string;
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

  // TODO: add failing test for `_id` being unimplemented here and then fix
  async adoptIntoRealm(realm: string, _id?: string): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    let builder = await this.cards.builder();
    let localRealm;
    if (realm === builder.realmURL) {
      localRealm = builder;
    }
    return new (this.constructor as typeof CardModelForBrowser)(
      this.cards,
      {
        type: 'created',
        realm,
        parentCardURL: this.state.url,
        componentModule: this.state.componentModule,
        schemaModuleId: this.state.schemaModuleId,
        format: this.state.format,
      },
      localRealm ?? this.localRealm
    );
  }

  setData(_data: RawCardData) {
    throw new Error('unimplemented');
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
    return this.state.format;
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
            this.state.componentModule.getCardModelOptions().serializerMap
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

  async component(): Promise<unknown> {
    if (!this.wrapperComponent) {
      let innerComponent = this.state.componentModule.default;
      let self = this;

      let syncData: Record<string, any> = {};
      for (let field of this.usedFields) {
        set(syncData, field, await this.getField(field));
      }

      this.wrapperComponent = setComponentTemplate(
        hbs`<this.component @model={{this.data}} @set={{this.set}} />`,
        class extends Component {
          component = innerComponent;
          data = syncData;
          set = self.setters;
        }
      );
    }
    return this.wrapperComponent;
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

  private async getRawField(fieldPath: string): Promise<any> {
    // TODO: deserialize only this field, instead of forcing all of this.data to
    // be deserialized
    return get(this.data, fieldPath);
  }

  async schemaInstance() {
    if (this._schemaInstance) {
      return this._schemaInstance;
    }
    let SchemaClass = (
      await this.loadModule<CardSchemaModule>(this.state.schemaModuleId)
    ).default;
    this._schemaInstance = new SchemaClass(this.getRawField.bind(this));
    return this._schemaInstance;
  }

  private async loadModule<T extends Object>(moduleId: string): Promise<T> {
    if (this.localRealm) {
      return await this.localRealm.loadModule<T>(moduleId);
    } else {
      return await this.cards.loadModule<T>(moduleId);
    }
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
      serializeAttributes(
        this.data,
        this.state.componentModule.getCardModelOptions().serializerMap
      )
    );
  }

  get usedFields(): ComponentInfo['usedFields'] {
    return this.state.componentModule.getCardModelOptions().usedFields;
  }

  async save(): Promise<void> {
    let response: JSONAPIDocument<Saved>;
    let original: CardModel | undefined;

    switch (this.state.type) {
      case 'created':
        if (this.localRealm) {
          response = await this.localRealm.create(
            this.state.parentCardURL,
            this.serialize()
          );
        } else {
          response = await this.createRemote();
        }
        break;
      case 'loaded':
        original = this.state.original;
        if (this.localRealm) {
          response = await this.localRealm.update(
            this.url,
            this.serialize() as ResourceObject<Saved> // loaded state is always saved
          );
        } else {
          response = await this.updateRemote();
        }
        break;
      default:
        throw assertNever(this.state);
    }

    let { data } = response;
    assertDocumentDataIsResource(data);

    this.state = {
      type: 'loaded',
      format: this.format,
      url: data.id,
      rawServerResponse: cloneDeep(data),
      deserialized: false,
      original,
      componentModule: this.state.componentModule,
      schemaModuleId: this.state.schemaModuleId,
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
