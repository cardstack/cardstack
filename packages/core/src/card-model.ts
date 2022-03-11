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
import cloneDeep from 'lodash/cloneDeep';
import isPlainObject from 'lodash/isPlainObject';
import { getFieldValue, makeEmptyCardData } from '@cardstack/core/src/utils/fields';
import { BadRequest, CardstackError, UnprocessableEntity } from './utils/errors';

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
  private schemaModuleRef: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private saveModel: CardModelArgs['saveModel'];
  private recomputePromise: Promise<void> = Promise.resolve();
  private schemaModule: CardSchemaModule | undefined;

  constructor(protected cards: CardService, state: CreatedState | LoadedState, args: CardModelArgs) {
    let { realm, schemaModuleRef, format, componentModuleRef, rawData, componentMeta, saveModel } = args;
    this._realm = realm;
    this.schemaModuleRef = schemaModuleRef;
    this._format = format;
    this.componentModuleRef = componentModuleRef;
    this.rawData = rawData;
    this.componentMeta = componentMeta;
    this.saveModel = saveModel;
    this.state = state;
    this.setters = this.makeSetter();
  }

  protected abstract get serializerMap(): SerializerMap;

  editable(): Promise<CardModelInterface> {
    throw new CardstackError('editable() is unsupported');
  }
  component(): Promise<unknown> {
    throw new CardstackError('component() is unsupported');
  }

  adoptIntoRealm(realm: string, id?: string): CardModelInterface {
    if (this.state.type !== 'loaded') {
      throw new CardstackError(`tried to adopt from an unsaved card`);
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
        schemaModuleRef: this.schemaModuleRef,
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
      throw new CardstackError(`bug: card in state ${this.state.type} does not have a url`);
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
      throw new CardstackError(`card ${this.url} in state ${this.state.type} does not support parentCardURL`);
    }
  }

  get usedFields(): string[] {
    if (!this.schemaModule) {
      throw new CardstackError(this.noSchemaModuleMsg());
    }
    return this.schemaModule.usedFields?.[this.format] ?? [];
  }

  get allFields(): string[] {
    if (!this.schemaModule) {
      throw new CardstackError(this.noSchemaModuleMsg());
    }
    return this.schemaModule.allFields ?? [];
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    let url: string | undefined;
    if (this.state.type === 'loaded') {
      url = this.state.url;
    } else if (this.state.id != null) {
      url = cardURL({ realm: this.realm, id: this.state.id });
    }

    if (this.state.type === 'created') {
      return serializeCardAsResource(url, this.getSchemaInstanceData('all-fields'), this.serializerMap);
    }

    let resource = serializeCardAsResource(
      url,
      this.getSchemaInstanceData(this.state.allFields ? 'all-fields' : 'used-fields'),
      this.serializerMap
    );
    resource.meta = merge(
      { componentModule: this.componentModuleRef, schemaModule: this.schemaModuleRef },
      resource.meta
    );
    return resource;
  }

  async save(): Promise<void> {
    await this.loadSchemaModule();

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
    await this.loadSchemaModule();
    let nonExistentFields = this.assertFieldsExists(data);
    if (nonExistentFields.length) {
      throw new BadRequest(
        `the field(s) ${nonExistentFields.map((f) => `'${f}'`).join(', ')} are not allowed to be set for the card ${
          this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
        }`
      );
    }

    this.rawData = merge(this.rawData, serializeAttributes(data, this.serializerMap, 'serialize'));
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
        let newError = new UnprocessableEntity(
          `Could not load field '${field}' for ${
            this.state.type === 'loaded' ? 'card ' + this.url : 'new card of type ' + this.parentCardURL
          }`
        );
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

  // TODO We should be able to get rid of this after the serializer has been
  // internalized into the schema instance
  protected async beginRecompute(): Promise<void> {
    // This is a hook for subclasses to override if there is initial async work
    // to do before doing the recompute
  }

  private async createSchemaInstance() {
    let schemaModule = await this.loadSchemaModule();
    let klass = schemaModule.default;
    // We can't await the instance creation in a separate, as it's thenable and confuses async methods
    return new klass(this.getRawField.bind(this)) as any;
  }

  private getRawField(fieldPath: string): any {
    let result = keySensitiveGet(this.rawData, fieldPath);
    if ('missing' in result) {
      throw new Error(`TODO: ${result.missing}`);
    } else {
      // TODO it would be wonderful if the schema instance knew how to deserialize its own fields
      return serializeField(this.serializerMap, fieldPath, result.value, 'deserialize');
    }
  }

  private async loadSchemaModule(): Promise<CardSchemaModule> {
    if (!this.schemaModule) {
      this.schemaModule = await this.cards.loadModule<CardSchemaModule>(this.schemaModuleRef);
      this._schemaInstance = await this.createSchemaInstance();
      this.setDataShape();
    }
    return this.schemaModule;
  }

  // This is rather awkward and scaffolding until the schema instance knows how
  // to serialize itself. Remove this as soon as it becomes possible
  private setDataShape() {
    if (this.state.type === 'created' || this.state.allFields) {
      this.rawData = merge(makeEmptyCardData(this.allFields), this.rawData);
    } else {
      this.rawData = merge(makeEmptyCardData(this.usedFields), this.rawData);
    }
  }

  private getSchemaInstanceData(type: 'all-fields' | 'used-fields'): Record<string, any> {
    if (!this.schemaModule) {
      throw new CardstackError(this.noSchemaModuleMsg());
    }
    if (!this._schemaInstance) {
      throw new CardstackError(this.noSchemaInstanceMsg());
    }
    return this.schemaModule.dataMember in this._schemaInstance
      ? this._schemaInstance[this.schemaModule.dataMember](type === 'all-fields' ? 'all' : this.format)
      : {};
  }

  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        return;
      }

      let data = this.getSchemaInstanceData('all-fields');
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
      this.rawData = serializeAttributes(data, this.serializerMap, 'serialize');
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

  private noSchemaModuleMsg() {
    return `The schema module has not yet been loaded for card ${
      this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
    }`;
  }
  private noSchemaInstanceMsg() {
    return `The schema instance has not yet been instantiated for card ${
      this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
    }`;
  }
}

// access a potentially-deep property path, stopping if a key is missing along
// the way
export function keySensitiveGet(obj: object, path: string): { missing: string } | { value: any } {
  let segments = path.split('.');
  let current: any = obj;
  let segment: string | undefined;
  let completed: string[] = [];
  while ((segment = segments.shift())) {
    if (!(segment in current)) {
      return { missing: [...completed, segment].join('.') };
    }
    current = current?.[segment];
    completed.push(segment);
  }
  return { value: current };
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
