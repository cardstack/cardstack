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
  Card,
} from '@cardstack/core/src/interfaces';
import { deserializeAttributes, serializeAttributes, serializeResource } from '@cardstack/core/src/serializers';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import isPlainObject from 'lodash/isPlainObject';
import { cardURL } from '@cardstack/core/src/utils';
import RealmManager from '../services/realm-manager';
import { SearchIndex } from '../services/search-index';
import { BadRequest, Conflict, isCardstackError } from '@cardstack/core/src/utils/errors';
// import { tracked } from '@glimmer/tracking';

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
}

interface LoadedState {
  type: 'loaded';
  id: string;
  realm: string;
  format: Format;
  serializerMap: SerializerMap;
  rawData: NonNullable<RawCard['data']>;
  schemaModule: CompiledCard['schemaModule']['global'];
  componentModule: ComponentInfo['moduleName']['global'];
  usedFields: ComponentInfo['usedFields'];
  deserialized: boolean;
  original: CardModel | undefined;
}

export interface CardServiceEnv {
  create: (raw: RawCard<Unsaved>) => Promise<Card>;
  loadData: (cardURL: string, format: Format) => Promise<CardModel>;
  realmManager: RealmManager;
  searchIndex: SearchIndex;
}

export default class CardModelForHub implements CardModel {
  setters: undefined;
  private _data: any;
  private state: CreatedState | LoadedState;

  constructor(private env: CardServiceEnv, state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>) {
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

  async adoptIntoRealm(realm: string, id?: string): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    if (this.format !== 'isolated') {
      throw new Error(`Can only adoptIntoRealm from an isolated card. This card is ${this.format}`);
    }
    if (id) {
      try {
        await this.env.loadData(cardURL({ realm, id }), 'isolated');
        throw new Conflict(`Card ${id} already exists in realm ${realm}`);
      } catch (e: any) {
        if (!isCardstackError(e) || e.status !== 404) {
          throw e;
        }
        // we expect a 404 here, so we can continue
      }
    }
    return new (this.constructor as typeof CardModelForHub)(this.env, {
      type: 'created',
      realm,
      id,
      usedFields: this.usedFields,
      parentCardURL: this.url,
      serializerMap: this.serializerMap,
      deserialized: true,
    });
  }

  get innerComponent(): unknown {
    throw new Error('Hub does not have use of innerComponent');
  }

  get serializerMap(): SerializerMap {
    return this.state.serializerMap;
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

  get data(): any {
    if (!this.state.deserialized && this.state.type === 'loaded') {
      this._data = deserializeAttributes(this.state.rawData, this.serializerMap);
      this.state.deserialized = true;
    }
    return this._data;
  }

  get component(): unknown {
    throw new Error('Hub does not have use of component');
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    if (this.state.type === 'created') {
      return serializeResource(
        'card',
        undefined,
        serializeAttributes(cloneDeep(this.data), this.serializerMap),
        this.usedFields
      );
    }
    let { usedFields, componentModule } = this.state;
    let resource = serializeResource(
      'card',
      this.url,
      serializeAttributes(cloneDeep(this.data), this.serializerMap),
      usedFields
    );
    resource.meta = merge(
      {
        componentModule,
      },
      resource.meta
    );
    return resource;
  }

  async save(): Promise<void> {
    let raw: RawCard, compiled: CompiledCard;
    switch (this.state.type) {
      case 'created':
        raw = await this.env.realmManager.create({
          id: this.state.id,
          realm: this.state.realm,
          adoptsFrom: this.state.parentCardURL,
          data: serializeAttributes(cloneDeep(this._data), this.serializerMap),
        });
        compiled = await this.env.searchIndex.indexData(raw);
        break;
      case 'loaded':
        {
          let original = await this.env.loadData(this.url, this.format);
          let updatedRawCard = merge(
            {
              id: this.state.id,
              realm: this.state.realm,
            },
            { data: original.data },
            { data: this.data }
          );

          serializeAttributes(updatedRawCard.data, this.serializerMap);
          raw = await this.env.realmManager.update(updatedRawCard);
          compiled = await this.env.searchIndex.indexData(raw);
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
      serializerMap: compiled['isolated'].serializerMap,
      rawData: raw.data ?? {},
      schemaModule: compiled.schemaModule.global,
      componentModule: compiled['isolated'].moduleName.global,
      usedFields: compiled['isolated'].usedFields,
      original: undefined,
      deserialized: false,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
