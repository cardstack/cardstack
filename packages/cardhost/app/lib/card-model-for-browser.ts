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
  CardService,
  CompiledCard,
  CardModelArgs,
  RawCard,
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
import { cardURL } from '@cardstack/core/src/utils';
import { getFieldValue } from '@cardstack/core/src/utils/fields';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { registerDestructor } from '@ember/destroyable';

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  id?: string;
  parentCardURL: string;
}

export interface LoadedState {
  type: 'loaded';
  url: string;
  original: CardModel | undefined;
}

export default class CardModelForBrowser implements CardModel {
  setters: Setter;
  @tracked private _schemaInstance: any | undefined;
  private _realm: string;
  private schemaModule: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private componentModule: CardComponentModule;
  private rawData: NonNullable<RawCard['data']>;
  private state: CreatedState | LoadedState;
  private wrapperComponent: unknown | undefined;
  private _schemaClass: CardSchemaModule['default'] | undefined;

  constructor(
    private cards: CardService,
    state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>,
    // TODO let's work on unifying these args with the CardModelForHub
    args: CardModelArgs & {
      componentModule: CardComponentModule;
    }
  ) {
    let { realm, schemaModule, format, componentModule, rawData } = args;
    this._realm = realm;
    this.schemaModule = schemaModule;
    this._format = format;
    this.componentModule = componentModule;
    this.rawData = rawData;
    if (state.type == 'created') {
      this.state = state;
    } else {
      this.state = {
        ...state,
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

    return new (this.constructor as typeof CardModelForBrowser)(
      this.cards,
      {
        type: 'created',
        id,
        parentCardURL: this.state.url,
      },
      {
        realm,
        format: this.format,
        componentModule: this.componentModule,
        schemaModule: this.schemaModule,
        rawData: { id: undefined, type: 'card', attributes: {} },
      }
    );
  }

  setData(_data: RawCardData) {
    throw new Error('unimplemented');
  }

  get id(): string {
    return this.url;
  }

  get realm(): string {
    return this._realm;
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
    return this._format;
  }

  get parentCardURL(): string {
    if (this.state.type === 'created') {
      return this.state.parentCardURL;
    } else {
      return this.rawData.attributes.adoptsFrom;
    }
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.loadData(
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
      let innerComponent = this.componentModule.default;
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

  private async createSchemaInstance() {
    let klass = await this.schemaClass();
    // We can't await the instance creation in a separate, as it's thenable and confuses async methods
    return new klass(this.getRawField.bind(this)) as any;
  }

  private getRawField(fieldPath: string): any {
    let value = get(this.rawData.attributes, fieldPath);
    return serializeField(this.serializerMap, fieldPath, value, 'deserialize');
  }

  async schemaClass() {
    if (this._schemaClass) {
      return this._schemaClass;
    }
    this._schemaClass = (
      await this.cards.loadModule<CardSchemaModule>(this.schemaModule)
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
    this.rawData = merge({}, this.rawData, {
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
      url = cardURL({ realm: this.realm, id: this.state.id });
    }

    return serializeCardAsResource(
      url,
      this.dataAsUsedFieldsShape(),
      this.serializerMap
    );
  }

  get serializerMap(): CardComponentModule['serializerMap'] {
    return this.componentModule.serializerMap;
  }

  get usedFields(): CardComponentModule['usedFields'] {
    return this.componentModule.usedFields;
  }

  async save(): Promise<void> {
    let response: JSONAPIDocument<Saved>;
    let original: CardModel | undefined;

    switch (this.state.type) {
      case 'created':
        response = await this.cards.createModel(this);
        break;
      case 'loaded':
        original = this.state.original;
        response = await this.cards.updateModel(this);
        break;
      default:
        throw assertNever(this.state);
    }

    let { data } = response;
    assertDocumentDataIsResource(data);

    this.rawData = cloneDeep(data);
    this.state = {
      type: 'loaded',
      url: data.id,
      original,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
