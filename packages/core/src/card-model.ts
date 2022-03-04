import {
  CompiledCard,
  Format,
  ResourceObject,
  Saved,
  Unsaved,
  RawCardData,
  ComponentInfo,
  assertDocumentDataIsResource,
  CardService,
  CardModelArgs,
  CardSchemaModule,
  CardComponentModule,
  CardModel as CardModelInterface,
  Setter,
  SerializerMap,
  CardComponentMetaModule,
} from '@cardstack/core/src/interfaces';
import { serializeCardAsResource, serializeField } from '@cardstack/core/src/serializers';
import merge from 'lodash/merge';
import { cardURL } from '@cardstack/core/src/utils';
import get from 'lodash/get';
import set from 'lodash/set';
import cloneDeep from 'lodash/cloneDeep';
import { getFieldValue } from '@cardstack/core/src/utils/fields';

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

export default abstract class CardModel implements CardModelInterface {
  protected _schemaInstance: any | undefined;
  protected componentModuleRef: ComponentInfo['componentModule']['global'];
  protected rawData: RawCardData;
  protected state: CreatedState | LoadedState;
  protected _componentModule: CardComponentModule | undefined;
  protected componentMeta: CardComponentMetaModule | undefined;

  private _realm: string;
  private schemaModule: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private saveModel: CardModelArgs['saveModel'];
  private _schemaClass: CardSchemaModule['default'] | undefined;

  constructor(protected cards: CardService, state: CreatedState | LoadedState, args: CardModelArgs) {
    let { realm, schemaModule, format, componentModuleRef, rawData, componentMeta, saveModel } = args;
    this._realm = realm;
    this.schemaModule = schemaModule;
    this._format = format;
    this.componentModuleRef = componentModuleRef;
    this.rawData = rawData;
    this.componentMeta = componentMeta;
    this.saveModel = saveModel;
    this.state = state;
  }

  abstract setters: Setter | undefined;
  abstract editable(): Promise<CardModelInterface>;
  abstract setData(data: RawCardData): void;
  abstract component(): Promise<unknown>;
  protected abstract get serializerMap(): SerializerMap;
  protected abstract get usedFields(): string[];
  protected abstract get allFields(): string[];
  protected abstract componentModule(): Promise<CardComponentModule | void>;

  adoptIntoRealm(realm: string, id?: string): CardModelInterface {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }

    return new (this.constructor as any)(
      this.cards,
      {
        type: 'created',
        id,
        parentCardURL: this.state.url,
      },
      {
        realm,
        format: this.format,
        rawData: { id: undefined, type: 'card', attributes: {} },
        saveModel: this.saveModel,
        schemaModule: this.schemaModule,
        componentMeta: this.componentMeta,
        componentModuleRef: this.componentModuleRef,
      }
    );
  }

  async computeData(schemaInstance?: any): Promise<Record<string, any>> {
    let syncData: Record<string, any> = {};
    for (let field of this.usedFields) {
      set(syncData, field, await this.getField(field, schemaInstance));
    }
    return syncData;
  }

  async getField(name: string, schemaInstance?: any): Promise<any> {
    schemaInstance = schemaInstance ?? this._schemaInstance;

    if (!schemaInstance) {
      schemaInstance = this._schemaInstance = await this.createSchemaInstance();
    }

    return await getFieldValue(schemaInstance, name);
  }

  get data(): object {
    return this._schemaInstance;
  }

  get id(): string | undefined {
    if (this.state.type === 'created') {
      return this.state.id;
    }
    return this.url.slice(this.realm.length);
  }

  get realm(): string {
    return this._realm;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(`bug: card in state ${this.state.type} does not have a url`);
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
      throw new Error(`card ${this.url} in state ${this.state.type} does not support parentCardURL`);
    }
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    let url: string | undefined;
    if (this.state.type === 'loaded') {
      url = this.state.url;
    } else if (this.state.id != null) {
      url = cardURL({ realm: this.realm, id: this.state.id });
    }

    if (this.state.type === 'created') {
      return serializeCardAsResource(url, this.shapeData('used-fields'), this.serializerMap);
    }

    let resource = serializeCardAsResource(
      url,
      this.shapeData(this.state.allFields ? 'all-fields' : 'used-fields'),
      this.serializerMap
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

    assertDocumentDataIsResource(data);
    this.rawData = cloneDeep(data.attributes ?? {});
    // on the browser the id will be the full URL, but on the hub, the id is
    // actually just the realm specific identifier
    let url = data.id.startsWith(this.realm) ? data.id : cardURL({ realm: this.realm, id: data.id });
    this.state = {
      type: 'loaded',
      url,
      allFields: false,
    };
  }

  // we have a few places that are very sensitive to the shape of the data, and
  // won't be able to deal with a schema instance that has additional properties
  // and methods beyond just the data itself, so this method is for those places
  protected shapeData(shape: 'used-fields' | 'all-fields') {
    let syncData: Record<string, any> = {};

    let fields = shape === 'used-fields' ? this.usedFields : this.allFields;
    for (let field of fields) {
      let value = get(this._schemaInstance, field);
      // undefined is a signal that the field should not exist
      if (value !== undefined) {
        set(syncData, field, value);
      }
    }
    return syncData;
  }

  protected async createSchemaInstance() {
    let klass = await this.schemaClass();
    // We can't await the instance creation in a separate, as it's thenable and confuses async methods
    return new klass(this.getRawField.bind(this)) as any;
  }

  private getRawField(fieldPath: string): any {
    let value = get(this.rawData, fieldPath);
    return serializeField(this.serializerMap, fieldPath, value, 'deserialize');
  }

  private async schemaClass() {
    if (this._schemaClass) {
      return this._schemaClass;
    }
    this._schemaClass = (await this.cards.loadModule<CardSchemaModule>(this.schemaModule)).default;

    return this._schemaClass;
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
