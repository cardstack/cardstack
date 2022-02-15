import {
  CardModel,
  SerializerMap,
  CompiledCard,
  ComponentInfo,
  RawCard,
  Format,
  ResourceObject,
  Saved,
  Unsaved,
  RawCardData,
} from '@cardstack/core/src/interfaces';
import { deserializeAttributes, serializeAttributes, serializeResource } from '@cardstack/core/src/serializers';
import { getOwner } from '@cardstack/di';
import merge from 'lodash/merge';
import isPlainObject from 'lodash/isPlainObject';
import { cardURL } from '@cardstack/core/src/utils';
import { BadRequest } from '@cardstack/core/src/utils/errors';
import get from 'lodash/get';
import { service } from '@cardstack/hub/services';
import { getFieldValue } from '@cardstack/core/src/utils/fields';

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  realm: string;
  id?: string;
  parentCardURL: string;
  serializerMap: SerializerMap;
  usedFields: ComponentInfo['usedFields'];
  deserialized: boolean;
  schemaModule: CompiledCard['schemaModule']['global'];
}

interface LoadedState {
  type: 'loaded';
  id: string;
  realm: string;
  format: Format;
  serializerMap: SerializerMap;
  rawData: NonNullable<RawCard['data']>;
  schemaModule: CompiledCard['schemaModule']['global'];
  componentModule: ComponentInfo['componentModule']['global'];
  usedFields: ComponentInfo['usedFields'];
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModelForHub implements CardModel {
  private fileCache = service('file-cache', { as: 'fileCache' });
  private realmManager = service('realm-manager', { as: 'realmManager' });
  private searchIndex = service('searchIndex');

  setters: undefined;
  private _data: any;
  private state: CreatedState | LoadedState;

  constructor(state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>) {
    if (state.type == 'created') {
      this.state = state;
    } else {
      this.state = {
        ...state,
        deserialized: false,
        original: undefined,
      };
    }
  }

  async getField(name: string): Promise<any> {
    // TODO: add isComputed somewhere in the metadata coming out of the compiler so we can do this optimization
    // if (this.isComputedField(name)) {
    //   TODO need to deserialize value
    //   return get(this.data, name);
    // }

    // TODO we probably want to cache the schemaInstance. It should only be
    // created the first time it's needed
    let SchemaClass = this.fileCache.loadModule(this.state.schemaModule).default;
    let schemaInstance = new SchemaClass((fieldPath: string) => get(this.data, fieldPath));

    // TODO need to deserialize value
    return await getFieldValue(schemaInstance, name);
  }

  async adoptIntoRealm(realm: string, id?: string): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    if (this.format !== 'isolated') {
      throw new Error(`Can only adoptIntoRealm from an isolated card. This card is ${this.format}`);
    }
    return await getOwner(this).instantiate(this.constructor as typeof CardModelForHub, {
      type: 'created',
      realm,
      id,
      usedFields: this.usedFields,
      parentCardURL: this.url,
      serializerMap: this.serializerMap,
      deserialized: true,
      schemaModule: this.state.schemaModule,
    });
  }

  get innerComponent(): unknown {
    throw new Error('Hub does not have use of innerComponent');
  }

  get serializerMap(): SerializerMap {
    return this.state.serializerMap;
  }

  get id(): string | undefined {
    return this.state.id;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(`bug: card in state ${this.state.type} does not have a url`);
    }
    return cardURL(this.state);
  }

  get format(): Format {
    if (this.state.type === 'created') {
      return 'isolated';
    }
    return this.state.format;
  }

  get usedFields(): ComponentInfo['usedFields'] {
    return this.state.usedFields;
  }

  async editable(): Promise<CardModel> {
    throw new Error('Hub does not have use of editable');
  }

  setData(data: RawCardData, deserialized = true): void {
    let nonExistentFields = this.assertFieldsExists(data);
    if (nonExistentFields.length) {
      throw new BadRequest(
        `the field(s) ${nonExistentFields.map((f) => `'${f}'`).join(', ')} are not allowed to be set for the card ${
          this.state.type === 'loaded' ? this.url : 'that adopts from ' + this.state.parentCardURL
        } in format '${this.format}'`
      );
    }
    this._data = data;
    this.state.deserialized = deserialized;
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

  // TODO: This will likely need to go to a field level deserialization so that
  // you know from a field-by-field perspective if a field has been deserialized
  get data(): any {
    if (!this.state.deserialized && this.state.type === 'loaded') {
      this._data = deserializeAttributes(this.state.rawData, this.serializerMap);
      this.state.deserialized = true;
    }
    return this._data;
  }

  async component(): Promise<unknown> {
    throw new Error('Hub does not have use of component');
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    if (this.state.type === 'created') {
      return serializeResource('card', undefined, serializeAttributes(this.data, this.serializerMap), this.usedFields);
    }
    let { usedFields, componentModule, schemaModule } = this.state;
    let resource = serializeResource('card', this.url, serializeAttributes(this.data, this.serializerMap), usedFields);
    resource.meta = merge(
      {
        componentModule,
        schemaModule,
      },
      resource.meta
    );
    return resource;
  }

  async save(): Promise<void> {
    let raw: RawCard, compiled: CompiledCard;
    switch (this.state.type) {
      case 'created':
        raw = await this.realmManager.create({
          id: this.state.id,
          realm: this.state.realm,
          adoptsFrom: this.state.parentCardURL,
          data: serializeAttributes(this._data, this.serializerMap),
        });
        compiled = await this.searchIndex.indexData(raw, this);
        break;
      case 'loaded':
        {
          let updatedRawCard = merge(
            {
              id: this.state.id,
              realm: this.state.realm,
            },
            { data: this.state.rawData }, // the original data
            { data: this.data }
          );

          updatedRawCard.data = serializeAttributes(updatedRawCard.data, this.serializerMap);
          raw = await this.realmManager.update(updatedRawCard);
          compiled = await this.searchIndex.indexData(raw, this);
        }
        break;
      default:
        throw assertNever(this.state);
    }
    this.state = {
      type: 'loaded',
      format: this.format,
      id: raw.id,
      realm: raw.realm,
      serializerMap: compiled.componentInfos['isolated'].serializerMap,
      rawData: raw.data ?? {},
      schemaModule: compiled.schemaModule.global,
      componentModule: compiled.componentInfos['isolated'].componentModule.global,
      usedFields: compiled.componentInfos['isolated'].usedFields,
      original: undefined,
      deserialized: false,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
