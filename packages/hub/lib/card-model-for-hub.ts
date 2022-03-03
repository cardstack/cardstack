import {
  CardModel,
  SerializerMap,
  CompiledCard,
  Format,
  ResourceObject,
  Saved,
  Unsaved,
  RawCardData,
  CardComponentMetaModule,
  ComponentInfo,
  CardService,
  CardModelArgs,
  CardSchemaModule,
} from '@cardstack/core/src/interfaces';
import { serializeAttributes, serializeCardAsResource, serializeField } from '@cardstack/core/src/serializers';
import { getOwner } from '@cardstack/di';
import merge from 'lodash/merge';
import isPlainObject from 'lodash/isPlainObject';
import { cardURL } from '@cardstack/core/src/utils';
import { BadRequest } from '@cardstack/core/src/utils/errors';
import get from 'lodash/get';
import set from 'lodash/set';
import { getFieldValue } from '@cardstack/core/src/utils/fields';

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  id?: string;
  parentCardURL: string;
}

interface LoadedState {
  type: 'loaded';
  id: string;
  allFields: boolean;
}

export default class CardModelForHub implements CardModel {
  private _schemaInstance: any | undefined;
  private _realm: string;
  private schemaModule: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private componentModuleRef: ComponentInfo['componentModule']['global'];
  private rawData: RawCardData;
  private saveModel: CardModelArgs['saveModel'];
  private state: CreatedState | LoadedState;
  private _schemaClass: CardSchemaModule['default'] | undefined;

  private componentMeta: CardComponentMetaModule;
  setters: undefined;

  constructor(
    private cards: CardService,
    state: CreatedState | Omit<LoadedState, 'deserialized'>,
    // TODO let's work on unifying these args with the CardModelForBrowser
    args: CardModelArgs & { componentMeta: CardComponentMetaModule }
  ) {
    let { rawData, realm, format, schemaModule, componentMeta, saveModel, componentModuleRef } = args;
    this._realm = realm;
    this._format = format;
    this.schemaModule = schemaModule;
    this.componentModuleRef = componentModuleRef;
    this.componentMeta = componentMeta;
    this.rawData = rawData;
    this.saveModel = saveModel;
    this.state = state;
  }

  async getField(name: string, schemaInstance?: any): Promise<any> {
    // TODO: add isComputed somewhere in the metadata coming out of the compiler so we can do this optimization
    // if (this.isComputedField(name)) {
    //   TODO need to deserialize value
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
    this._schemaClass = (await this.cards.loadModule<CardSchemaModule>(this.schemaModule)).default;

    return this._schemaClass;
  }

  async adoptIntoRealm(realm: string, id?: string): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    if (this.format !== 'isolated') {
      throw new Error(`Can only adoptIntoRealm from an isolated card. This card is ${this.format}`);
    }
    return await getOwner(this).instantiate(
      this.constructor as typeof CardModelForHub,
      this.cards,
      {
        type: 'created',
        id,
        parentCardURL: this.url,
      },
      {
        realm,
        format: this.format,
        rawData: {},
        saveModel: this.saveModel,
        schemaModule: this.schemaModule,
        componentModuleRef: this.componentModuleRef,
        componentMeta: this.componentMeta,
      }
    );
  }

  get innerComponent(): unknown {
    throw new Error('Hub does not have use of innerComponent');
  }

  get serializerMap(): SerializerMap {
    return this.componentMeta.serializerMap;
  }

  get id(): string | undefined {
    return this.state.id;
  }
  get realm(): string {
    return this._realm;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(`bug: card in state ${this.state.type} does not have a url yet`);
    }
    return cardURL({ realm: this.realm, id: this.state.id });
  }

  get format() {
    return this._format;
  }

  get parentCardURL(): string {
    if (this.state.type === 'created') {
      return this.state.parentCardURL;
    } else {
      throw new Error(`card ${this.url} in state ${this.state.type} does not support parentCardURL`);
    }
  }

  get usedFields(): CardComponentMetaModule['usedFields'] {
    return this.componentMeta.usedFields;
  }

  async editable(): Promise<CardModel> {
    throw new Error('Hub does not have use of editable');
  }

  // TODO refactor to use CardModelForBrowser's setter
  async setData(data: RawCardData): Promise<void> {
    let nonExistentFields = this.assertFieldsExists(data);
    if (nonExistentFields.length) {
      throw new BadRequest(
        `the field(s) ${nonExistentFields.map((f) => `'${f}'`).join(', ')} are not allowed to be set for the card ${
          this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
        } in format '${this.format}'`
      );
    }

    // TODO need to write a test that proves data consistency
    this.rawData = serializeAttributes(merge({}, this.rawData, data), this.serializerMap);
    let newSchemaInstance = await this.createSchemaInstance();
    await this.computeData(newSchemaInstance);
    this._schemaInstance = newSchemaInstance;
  }

  // TODO: we need to really use a validation mechanism which will use code from
  // the schema.js module to validate the fields
  private assertFieldsExists(data: RawCardData, path = ''): string[] {
    let nonExistentFields: string[] = [];
    for (let [field, value] of Object.entries(data)) {
      let fieldPath = path ? `${path}.${field}` : field;
      if (isPlainObject(value)) {
        nonExistentFields = [...nonExistentFields, ...this.assertFieldsExists(value, fieldPath)];
      } else if (!this.usedFields.includes(fieldPath)) {
        nonExistentFields.push(fieldPath);
      }
    }
    return nonExistentFields;
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
    throw new Error('Hub does not have use of component');
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
    if (this.state.type === 'created') {
      return serializeCardAsResource(undefined, this.dataAsUsedFieldsShape(), this.serializerMap);
    }

    let resource = serializeCardAsResource(
      this.url,
      this.rawData,
      this.serializerMap,
      !this.state.allFields ? this.usedFields : undefined
    );
    resource.meta = merge({ componentModule: this.componentModuleRef, schemaModule: this.schemaModule }, resource.meta);

    return resource;
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
    this.rawData = data.attributes ?? {};
    this.state = {
      type: 'loaded',
      id: data.id,
      allFields: false,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
