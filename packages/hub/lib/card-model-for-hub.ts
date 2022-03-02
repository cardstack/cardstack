import {
  CardModel,
  SerializerMap,
  CompiledCard,
  RawCard,
  Format,
  ResourceObject,
  Saved,
  Unsaved,
  RawCardData,
  CardComponentMetaModule,
  ComponentInfo,
  CardService,
  CardModelArgs,
} from '@cardstack/core/src/interfaces';
import { deserializeAttributes, serializeAttributes, serializeCardAsResource } from '@cardstack/core/src/serializers';
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
  id?: string;
  parentCardURL: string;
}

interface LoadedState {
  type: 'loaded';
  id: string;
  componentModule: ComponentInfo['componentModule']['global'];
  original: CardModel | undefined;
  allFields: boolean;
}

export default class CardModelForHub implements CardModel {
  private fileCache = service('file-cache', { as: 'fileCache' });
  private realmManager = service('realm-manager', { as: 'realmManager' });
  private searchIndex = service('searchIndex');
  private deserialized: boolean; // TODO is this really needed?

  setters: undefined;
  private _data: any;
  private state: CreatedState | LoadedState;
  private _realm: string;
  private schemaModule: CompiledCard['schemaModule']['global'];
  private componentMeta: CardComponentMetaModule;
  private _format: Format;
  private rawData: NonNullable<RawCard['data']>;

  constructor(
    private cards: CardService,
    state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>,
    // TODO let's work on unifying these args with the CardModelForBrowser
    args: CardModelArgs & { componentMeta: CardComponentMetaModule; deserialized?: boolean }
  ) {
    let { rawData, realm, format, schemaModule, componentMeta, deserialized = false } = args;
    this._realm = realm;
    this._format = format;
    this.schemaModule = schemaModule;
    this.deserialized = deserialized;
    this.componentMeta = componentMeta;
    this.rawData = rawData;
    if (state.type == 'created') {
      this.state = state;
    } else {
      this.state = {
        ...state,
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
    let SchemaClass = this.fileCache.loadModule(this.schemaModule).default;
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
        schemaModule: this.schemaModule,
        componentMeta: this.componentMeta,
        deserialized: true,
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
      return this.rawData.attributes.adoptsFrom;
    }
  }

  get usedFields(): CardComponentMetaModule['usedFields'] {
    return this.componentMeta.usedFields;
  }

  async editable(): Promise<CardModel> {
    throw new Error('Hub does not have use of editable');
  }

  // TODO I think we might have a bug here because we are not setting the
  // this.state.rawData--how will computeds work if we are not setting this? We
  // should use the CardModelForBrowser's setters to set the data
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
    this.deserialized = deserialized;
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
    if (!this.deserialized && this.state.type === 'loaded') {
      this._data = deserializeAttributes(this.rawData, this.serializerMap);
      this.deserialized = true;
    }
    return this._data;
  }

  async component(): Promise<unknown> {
    throw new Error('Hub does not have use of component');
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    if (this.state.type === 'created') {
      return serializeCardAsResource(undefined, this.data, this.serializerMap);
    }

    let resource = serializeCardAsResource(
      this.url,
      this.data,
      this.serializerMap,
      !this.state.allFields ? this.usedFields : undefined
    );
    let { componentModule } = this.state;
    resource.meta = merge({ componentModule, schemaModule: this.schemaModule }, resource.meta);

    return resource;
  }

  async save(): Promise<void> {
    let raw: RawCard, compiled: CompiledCard;
    switch (this.state.type) {
      case 'created':
        // TODO move this into CardService
        raw = await this.realmManager.create({
          id: this.state.id,
          realm: this.realm,
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
              realm: this.realm,
            },
            { data: this.rawData }, // the original data
            { data: this.data }
          );

          // TODO move this into CardService
          updatedRawCard.data = serializeAttributes(updatedRawCard.data, this.serializerMap);
          raw = await this.realmManager.update(updatedRawCard);
          compiled = await this.searchIndex.indexData(raw, this);
        }
        break;
      default:
        throw assertNever(this.state);
    }
    this.deserialized = false;
    this.rawData = raw.data ?? {};
    this.state = {
      type: 'loaded',
      id: raw.id,
      componentModule: compiled.componentInfos['isolated'].componentModule.global,
      original: undefined,
      allFields: false,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
