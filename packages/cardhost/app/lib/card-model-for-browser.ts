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
  SerializerName,
} from '@cardstack/core/src/interfaces';
// import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import { cloneDeep } from 'lodash';
import { tracked as _tracked } from '@glimmer/tracking';
import {
  inversedSerializerMap,
  serializeResource,
  SERIALIZERS,
} from '@cardstack/core/src/serializers';
import set from 'lodash/set';
import get from 'lodash/get';
import Cards from 'cardhost/services/cards';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';
import LocalRealm, { LOCAL_REALM } from './builder';
import { cardURL } from '@cardstack/core/src/utils';
import { getFieldValue } from '@cardstack/core/src/utils/fields';

const { cardServer } = config as any; // Environment types arent working

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  id?: string;
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
  private _schemaClass: CardSchemaModule['default'] | undefined;

  private inversedSerializerMap: Record<string, SerializerName>;

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

    // TEMP: needed until serializerMap restructure
    this.inversedSerializerMap = inversedSerializerMap(this.serializerMap);

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

    let localRealm: LocalRealm | undefined;
    if (realm === LOCAL_REALM) {
      localRealm = this.localRealm ?? (await this.cards.builder());
    }

    return new (this.constructor as typeof CardModelForBrowser)(
      this.cards,
      {
        type: 'created',
        id,
        realm,
        parentCardURL: this.state.url,
        componentModule: this.state.componentModule,
        schemaModuleId: this.state.schemaModuleId,
        format: this.state.format,
      },
      localRealm
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

    // TODO: This is temp until we figure out the async data issue
    // Without this .data is not populated
    await editable.computeData();

    (editable.state as LoadedState).original = this;
    return editable;
  }

  // TODO: Consolidate this into getField work
  // It cant happen until the syncData we generate
  // in component is the same data we use elsewhere
  get data(): any {
    return this._data;
  }

  async computeData() {
    let syncData: Record<string, any> = {};
    for (let field of this.usedFields) {
      set(syncData, field, await this.getField(field));
    }
    this._data = syncData;
  }

  async component(): Promise<unknown> {
    if (!this.wrapperComponent) {
      let innerComponent = this.state.componentModule.default;
      let self = this;

      await this.computeData();

      this.wrapperComponent = setComponentTemplate(
        hbs`<this.component @model={{this.data}} @set={{this.set}} />`,
        class extends Component {
          component = innerComponent;
          // TODO: Ed mentioned something about this needing to be full separate. Should we clone?
          data = self.data;
          set = self.setters;
        }
      );
    }
    return this.wrapperComponent;
  }

  async getField(fieldPath: string): Promise<any> {
    // TODO: add isComputed somewhere in the metadata coming out of the compiler so we can do this optimization
    // if (this.isComputedField(name)) {
    //   return get(this.data, name);
    // }

    if (!this._schemaInstance) {
      let klass = await this.schemaClass();
      // We can't await the instance creation in a separate, as it's thenable and confuses async methods
      this._schemaInstance = new klass(this.getRawField.bind(this)) as any;
    }

    return await getFieldValue(this._schemaInstance, fieldPath);
  }

  get rawData(): any {
    if (this.state.type === 'loaded') {
      return this.state.rawServerResponse.attributes;
    }

    // TODO: not sure
    return {};
  }

  private getRawField(fieldPath: string): any {
    let value = get(this.rawData, fieldPath);
    return serializeField(
      this.inversedSerializerMap,
      fieldPath,
      value,
      'deserialize'
    );
  }

  async schemaClass() {
    if (this._schemaClass) {
      return this._schemaClass;
    }
    this._schemaClass = (
      await this.cards.loadModule<CardSchemaModule>(this.state.schemaModuleId)
    ).default;

    return this._schemaClass;
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
    let url: string | undefined;
    if (this.state.type === 'loaded') {
      url = this.state.url;
    } else if (this.state.id != null) {
      url = cardURL({ realm: this.state.realm, id: this.state.id });
    }

    let attributes = cloneDeep(this.data);
    let map = this.inversedSerializerMap;
    for (let field of Object.keys(map)) {
      let value = serializeField(
        this.inversedSerializerMap,
        field,
        get(attributes, field),
        'serialize'
      );
      set(attributes, field, value);
    }

    return serializeResource('card', url, attributes);
  }

  get serializerMap(): ComponentInfo['serializerMap'] {
    return this.state.componentModule.getCardModelOptions().serializerMap;
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

function serializeField(
  serializerMap: Record<string, SerializerName>,
  fieldPath: string,
  value: any,
  action: 'serialize' | 'deserialize'
) {
  if (!value) {
    return;
  }
  let serializerName = get(serializerMap, fieldPath);
  if (serializerName) {
    let serializer = SERIALIZERS[serializerName];
    return serializer[action](value);
  }

  return value;
}
