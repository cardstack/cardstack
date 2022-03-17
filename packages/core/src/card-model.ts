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
  Setter,
} from '@cardstack/core/src/interfaces';
import merge from 'lodash/merge';
import { cardURL } from '@cardstack/core/src/utils';
import cloneDeep from 'lodash/cloneDeep';
import difference from 'lodash/difference';
import { flattenData, getFieldValue, keySensitiveSet, makeEmptyCardData } from '@cardstack/core/src/utils/fields';
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

export interface CardModelConstructor {
  new (...params: ConstructorParameters<typeof CardModel>): CardModel;
}

export default class CardModel {
  setters: Setter;

  protected _schemaInstance: any | undefined;
  protected componentModuleRef: ComponentInfo['componentModule']['global'];
  protected rawData: RawCardData;
  protected state: CreatedState | LoadedState;

  private _realm: string;
  private schemaModuleRef: CompiledCard['schemaModule']['global'];
  private _format: Format;
  private saveModel: CardModelArgs['saveModel'];
  private recomputePromise: Promise<void> = Promise.resolve();
  private schemaModule: CardSchemaModule;

  constructor(protected cards: CardService, state: CreatedState | LoadedState, args: CardModelArgs) {
    let { realm, schemaModuleRef, schemaModule, format, componentModuleRef, rawData, saveModel } = args;
    this._realm = realm;
    this.schemaModuleRef = schemaModuleRef;
    this.schemaModule = schemaModule;
    this._format = format;
    this.componentModuleRef = componentModuleRef;
    this.saveModel = saveModel;
    this.state = state;
    this.setters = this.makeSetter();

    // TODO move this logic into the schema instance
    if (this.state.type === 'created' || this.state.allFields) {
      this.rawData = merge(makeEmptyCardData(this.allFields), rawData);
    } else {
      this.rawData = merge(makeEmptyCardData(this.usedFields), rawData);
    }
    this._schemaInstance = this.createSchemaInstance();
  }

  editable(): Promise<CardModel> {
    throw new CardstackError('editable() is unsupported');
  }
  component(): Promise<unknown> {
    throw new CardstackError('component() is unsupported');
  }

  adoptIntoRealm(realm: string, id?: string): CardModel {
    if (this.state.type !== 'loaded') {
      throw new CardstackError(`tried to adopt from an unsaved card`);
    }

    return new (this.constructor as CardModelConstructor)(
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
        schemaModule: this.schemaModule,
        componentModuleRef: this.componentModuleRef,
      }
    );
  }

  async getField(name: string, schemaInstance?: any): Promise<any> {
    return await getFieldValue(schemaInstance ?? this._schemaInstance, name);
  }

  get data(): Record<string, any> {
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

  serialize(): ResourceObject<Saved | Unsaved> {
    let url: string | undefined;
    if (this.state.type === 'loaded') {
      url = this.state.url;
    } else if (this.state.id != null) {
      url = cardURL({ realm: this.realm, id: this.state.id });
    }
    let format = this.state.type === 'created' || this.state.allFields ? 'all' : (this.format as Format | 'all');
    let resource: ResourceObject<Saved | Unsaved> = {
      id: url,
      type: 'card',
      attributes: this.schemaModule.default.serialize(this._schemaInstance, format),
    };
    if (this.state.type === 'loaded') {
      resource.meta = merge(
        { componentModule: this.componentModuleRef, schemaModule: this.schemaModuleRef },
        resource.meta
      );
    }
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
    let flattened = flattenData(data);
    let nonExistentFields = difference(
      flattened.map(([f]) => f),
      this.allFields
    );
    if (nonExistentFields.length) {
      throw new BadRequest(
        `the field(s) ${nonExistentFields.map((f) => `'${f}'`).join(', ')} are not allowed to be set for the card ${
          this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
        }`
      );
    }
    let newSchemaInstance = this.createSchemaInstance();
    for (let [field, value] of flattened) {
      keySensitiveSet(newSchemaInstance, field, value);
    }
    await this.recompute(newSchemaInstance);
  }

  protected async didRecompute(): Promise<void> {
    return await this.recomputePromise;
  }

  async recompute(newSchemaInstance?: any): Promise<void> {
    // Note that after each async step we check to see if we are still the
    // current promise, otherwise we bail

    let done: () => void;
    let recomputePromise = (this.recomputePromise = new Promise<void>((res) => (done = res)));

    // wait a full micro task before we start - this is simple debounce
    await Promise.resolve();
    if (this.recomputePromise !== recomputePromise) {
      return;
    }

    newSchemaInstance = newSchemaInstance ?? this.createSchemaInstance();
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

  private get usedFields(): string[] {
    return this.schemaModule.default.usedFields?.[this.format] ?? [];
  }

  private get allFields(): string[] {
    return this.schemaModule.default.allFields ?? [];
  }

  private createSchemaInstance() {
    let klass = this.schemaModule.default;
    // We can't await the instance creation in a separate, as it's thenable and confuses async methods
    return new klass(this.rawData) as any;
  }

  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        return;
      }
      let newSchemaInstance = this.createSchemaInstance();
      let cursor: any = newSchemaInstance;
      for (let segment of innerSegments) {
        let nextCursor = cursor[segment];
        if (!nextCursor) {
          nextCursor = {};
          cursor[segment] = nextCursor;
        }
        cursor = nextCursor;
      }
      cursor[lastSegment] = value;
      this.recompute(newSchemaInstance);
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
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
