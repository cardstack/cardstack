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
  CardModel as CardModelInterface,
  Setter,
  SerializerMap,
  CardComponentMetaModule,
} from '@cardstack/core/src/interfaces';
import { serializeAttributes, serializeCardAsResource, serializeField } from '@cardstack/core/src/serializers';
import merge from 'lodash/merge';
import { cardURL } from '@cardstack/core/src/utils';
import get from 'lodash/get';
import set from 'lodash/set';
import cloneDeep from 'lodash/cloneDeep';
import isPlainObject from 'lodash/isPlainObject';
import { getFieldValue } from '@cardstack/core/src/utils/fields';
import { BadRequest, UnprocessableEntity } from './utils/errors';

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
  setters: Setter;

  protected _schemaInstance: any | undefined;
  protected componentModuleRef: ComponentInfo['componentModule']['global'];
  protected rawData: RawCardData;
  protected state: CreatedState | LoadedState;
  protected componentMeta: CardComponentMetaModule | undefined;

  private _realm: string;
  private schemaModule: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private saveModel: CardModelArgs['saveModel'];
  private _schemaClass: CardSchemaModule['default'] | undefined;
  private recomputePromise: Promise<void> = Promise.resolve();

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
    this.setters = this.makeSetter();
  }

  protected abstract get serializerMap(): SerializerMap;
  protected abstract get usedFields(): string[];
  protected abstract get allFields(): string[];

  editable(): Promise<CardModelInterface> {
    throw new Error('editable() is unsupported');
  }
  component(): Promise<unknown> {
    throw new Error('component() is unsupported');
  }

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
        rawData: {},
        saveModel: this.saveModel,
        schemaModule: this.schemaModule,
        componentMeta: this.componentMeta,
        componentModuleRef: this.componentModuleRef,
      }
    );
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

  async setData(data: RawCardData): Promise<void> {
    let nonExistentFields = this.assertFieldsExists(data);
    if (nonExistentFields.length) {
      throw new BadRequest(
        `the field(s) ${nonExistentFields.map((f) => `'${f}'`).join(', ')} are not allowed to be set for the card ${
          this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
        }`
      );
    }

    let serializedData = serializeAttributes(data, this.serializerMap, 'serialize');
    this.rawData = merge({}, this.rawData, serializedData);
    await this.recompute();
  }

  async didRecompute(): Promise<void> {
    return await this.recomputePromise;
  }

  async recompute(): Promise<void> {
    // Note that after each async step we check to see if we are still the
    // current promise, otherwise we bail

    let done: () => void;
    let recomputePromise = (this.recomputePromise = new Promise<void>((res) => (done = res)));

    // wait a full micro task before we start - this is simple debounce
    await Promise.resolve();
    if (this.recomputePromise !== recomputePromise) {
      return;
    }

    await this.beginRecompute();
    if (this.recomputePromise !== recomputePromise) {
      return;
    }

    let newSchemaInstance = await this.createSchemaInstance();
    if (this.recomputePromise !== recomputePromise) {
      return;
    }

    for (let field of this.usedFields) {
      try {
        await this.getField(field, newSchemaInstance);
      } catch (err: any) {
        let newError = new UnprocessableEntity(`Could not load field '${field}' for card ${this.url}`);
        newError.additionalErrors = [err, ...(err.additionalErrors || [])];
        throw newError;
      }
      if (this.recomputePromise !== recomputePromise) {
        return;
      }
    }

    this._schemaInstance = newSchemaInstance;
    done!();
  }

  protected async beginRecompute(): Promise<void> {
    // This is a hook for subclasses to override if there is initial async work
    // to do before doing the recompute
  }

  // we have a few places that are very sensitive to the shape of the data, and
  // won't be able to deal with a schema instance that has additional properties
  // and methods beyond just the data itself, so this method is for those places
  private shapeData(shape: 'used-fields' | 'all-fields') {
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

  private async createSchemaInstance() {
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

  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        return;
      }

      let data = this.shapeData('all-fields');
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
      let serializedData = serializeAttributes(data, this.serializerMap, 'serialize');
      this.rawData = serializedData;
      this.recompute();
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

  // TODO: we need to really use a validation mechanism which will use code from
  // the schema.js module to validate the fields
  private assertFieldsExists(data: RawCardData, path = ''): string[] {
    let nonExistentFields: string[] = [];
    for (let [field, value] of Object.entries(data)) {
      let fieldPath = path ? `${path}.${field}` : field;
      if (isPlainObject(value)) {
        nonExistentFields = [...nonExistentFields, ...this.assertFieldsExists(value, fieldPath)];
      } else if (!this.allFields.includes(fieldPath)) {
        nonExistentFields.push(fieldPath);
      }
    }
    return nonExistentFields;
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
