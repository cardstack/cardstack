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
  CardComponentModule,
  CardSchemaModule,
} from '@cardstack/core/src/interfaces';
import Component from '@glimmer/component';
// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import set from 'lodash/set';
import get from 'lodash/get';
import { tracked } from '@glimmer/tracking';
import {
  serializeField,
  serializeCardAsResource,
} from '@cardstack/core/src/serializers';
import Cards from 'cardhost/services/cards';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';
import LocalRealm, { LOCAL_REALM } from './builder';
import { cardURL } from '@cardstack/core/src/utils';
import { getFieldValue } from '@cardstack/core/src/utils/fields';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { registerDestructor } from '@ember/destroyable';

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
  rawData: ResourceObject<Unsaved>;
}

export interface LoadedState {
  type: 'loaded';
  format: Format;
  url: string;
  rawData: ResourceObject<Saved>;
  componentModule: CardComponentModule;
  schemaModuleId: string;
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModelForBrowser implements CardModel {
  setters: Setter;
  @tracked private _schemaInstance: any | undefined;
  private state: CreatedState | LoadedState;
  private wrapperComponent: unknown | undefined;
  private _schemaClass: CardSchemaModule['default'] | undefined;

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
    registerDestructor(this, this.rerenderFinished.bind(this));
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
        rawData: { id: undefined, type: 'card', attributes: {} },
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

    await editable.computeData();

    (editable.state as LoadedState).original = this;
    return editable;
  }

  get data(): object {
    return this._schemaInstance;
  }

  async computeData(schemaInstance?: any): Promise<Record<string, any>> {
    let syncData: Record<string, any> = {};
    for (let field of this.usedFields) {
      set(syncData, field, await this.getField(field, schemaInstance));
    }
    return syncData;
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
          set = self.setters;
          get data() {
            return self.data;
          }
        }
      );
    }
    return this.wrapperComponent;
  }

  async getField(fieldPath: string, schemaInstance?: any): Promise<any> {
    // TODO: add isComputed somewhere in the metadata coming out of the compiler so we can do this optimization
    // if (this.isComputedField(name)) {
    //   return get(this.data, name);
    // }

    schemaInstance = schemaInstance ?? this._schemaInstance;

    if (!schemaInstance) {
      schemaInstance = this._schemaInstance = await this.createSchemaInstance();
    }

    return await getFieldValue(schemaInstance, fieldPath);
  }

  get rawData(): any {
    return this.state.rawData.attributes;
  }

  private async createSchemaInstance() {
    let klass = await this.schemaClass();
    // We can't await the instance creation in a separate, as it's thenable and confuses async methods
    return new klass(this.getRawField.bind(this)) as any;
  }

  private getRawField(fieldPath: string): any {
    let value = get(this.rawData, fieldPath);
    return serializeField(this.serializerMap, fieldPath, value, 'deserialize');
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
        return;
      }

      let data = this.dataAsUsedFieldsShape();
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
      taskFor(this.rerenderData).perform(data);
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

  @restartableTask async rerenderData(
    data: Record<string, any>
  ): Promise<void> {
    this.state.rawData = merge({}, this.state.rawData, {
      attributes: data,
    });
    let newSchemaInstance = await this.createSchemaInstance();
    await this.computeData(newSchemaInstance);
    this._schemaInstance = newSchemaInstance;
  }

  async rerenderFinished() {
    await taskFor(this.rerenderData).last;
  }

  // we have a few places that are very sensitive to the shape of the data, and
  // won't be able to deal with a schema instance that has additional properties
  // and methods beyond just the data itself, so this method is for those places
  private dataAsUsedFieldsShape() {
    let syncData: Record<string, any> = {};
    for (let field of this.usedFields) {
      set(syncData, field, get(this._schemaInstance, field));
    }
    return syncData;
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    let url: string | undefined;
    if (this.state.type === 'loaded') {
      url = this.state.url;
    } else if (this.state.id != null) {
      url = cardURL({ realm: this.state.realm, id: this.state.id });
    }

    return serializeCardAsResource(
      url,
      this.dataAsUsedFieldsShape(),
      this.serializerMap
    );
  }

  get serializerMap(): CardComponentModule['serializerMap'] {
    return this.state.componentModule.serializerMap;
  }

  get usedFields(): CardComponentModule['usedFields'] {
    return this.state.componentModule.usedFields;
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
      rawData: cloneDeep(data),
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

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
