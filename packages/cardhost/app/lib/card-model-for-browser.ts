import {
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
  ComponentInfo,
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
  allFields: boolean;
}

export default class CardModelForBrowser implements CardModel {
  @tracked private _schemaInstance: any | undefined;
  private _realm: string;
  private schemaModule: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private componentModuleRef: ComponentInfo['componentModule']['global'];
  private rawData: RawCardData;
  private saveModel: CardModelArgs['saveModel'];
  private state: CreatedState | LoadedState;
  private _schemaClass: CardSchemaModule['default'] | undefined;

  setters: Setter;
  private wrapperComponent: unknown | undefined;
  private _componentModule: CardComponentModule | undefined;

  constructor(
    private cards: CardService,
    state: CreatedState | LoadedState,
    args: CardModelArgs
  ) {
    let {
      realm,
      schemaModule,
      format,
      componentModuleRef,
      rawData,
      saveModel,
    } = args;
    this._realm = realm;
    this.schemaModule = schemaModule;
    this._format = format;
    this.componentModuleRef = componentModuleRef;
    this.rawData = rawData;
    this.saveModel = saveModel;
    this.state = state;

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
        componentModuleRef: this.componentModuleRef,
        schemaModule: this.schemaModule,
        rawData: { id: undefined, type: 'card', attributes: {} },
        saveModel: this.saveModel,
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
      throw new Error(
        `card ${this.url} in state ${this.state.type} does not support parentCardURL`
      );
    }
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.loadModel(
      this.state.url,
      'edit'
    )) as CardModelForBrowser;

    await editable.computeData();

    return editable;
  }

  get data(): object {
    return this._schemaInstance;
  }

  async computeData(schemaInstance?: any): Promise<Record<string, any>> {
    // need to prime the component module since usedFields originates from there
    await this.componentModule();
    let syncData: Record<string, any> = {};
    for (let field of this.usedFields) {
      set(syncData, field, await this.getField(field, schemaInstance));
    }
    return syncData;
  }

  private async componentModule() {
    if (!this._componentModule) {
      this._componentModule = await this.cards.loadModule<CardComponentModule>(
        this.componentModuleRef
      );
    }
    return this._componentModule;
  }

  get serializerMap(): CardComponentModule['serializerMap'] {
    if (!this._componentModule) {
      throw new Error(
        `ComponentModule has not yet been loaded for card model ${this.url}`
      );
    }
    return this._componentModule.serializerMap;
  }

  get usedFields(): CardComponentModule['usedFields'] {
    if (!this._componentModule) {
      throw new Error(
        `ComponentModule has not yet been loaded for card model ${this.url}`
      );
    }
    return this._componentModule.usedFields;
  }

  async component(): Promise<unknown> {
    if (!this.wrapperComponent) {
      let innerComponent = (await this.componentModule()).default;
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

  async getField(name: string, schemaInstance?: any): Promise<any> {
    // TODO: add isComputed somewhere in the metadata coming out of the compiler so we can do this optimization
    // if (this.isComputedField(name)) {
    //   return get(this.data, name);
    // }

    schemaInstance = schemaInstance ?? this._schemaInstance;

    if (!schemaInstance) {
      schemaInstance = this._schemaInstance = await this.createSchemaInstance();
    }

    return await getFieldValue(schemaInstance, name);
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
    this.rawData = merge({}, this.rawData, data);
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

  async save(): Promise<void> {
    let data: ResourceObject<Saved>;
    switch (this.state.type) {
      case 'created':
        data = await this.saveModel(this, 'create');
        break;
      case 'loaded':
        data = await this.saveModel(this, 'update');
        break;
      default:
        throw assertNever(this.state);
    }

    assertDocumentDataIsResource(data);

    this.rawData = cloneDeep(data.attributes ?? {});
    this.state = {
      type: 'loaded',
      url: data.id,
      allFields: false,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
