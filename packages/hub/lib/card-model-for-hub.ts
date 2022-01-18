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
  CardContent,
  RawCardData,
} from '@cardstack/core/src/interfaces';
import { deserializeAttributes, serializeAttributes, serializeResource } from '@cardstack/core/src/serializers';
import { CardService } from '../services/card-service';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import { cardURL } from '@cardstack/core/src/utils';
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

export default class CardModelForHub implements CardModel {
  setters: undefined;
  private _data: any;
  private state: CreatedState | LoadedState;

  constructor(private cardService: CardService, state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>) {
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

  adoptIntoRealm(realm: string, id?: string): CardModel {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    // assert the card is in isolated format, and then the used fields for the
    // new card are the same as the used fields for the parent card. Now we have usedFields for cards in a 'created' state...
    return new (this.constructor as typeof CardModelForHub)(this.cardService, {
      type: 'created',
      realm,
      id,
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

  async editable(): Promise<CardModel> {
    throw new Error('Hub does not have use of editable');
  }

  setData(data: RawCardData): void {
    this._data = data;
    this.state.deserialized = true;
  }

  get data(): any {
    if (!this.state.deserialized && this.state.type === 'loaded') {
      this._data = deserializeAttributes(this.state.rawData, this.serializerMap);
      this.state.deserialized = true;
    }
    return this._data;
  }

  /**
   * @deprecated temporary scaffolding until card-service's CardContent => CardModel
   * refactor complete. Consumers of CardModel should be refactored to use `data`
   * and other TBD methods instead of this.
   */
  get cardContent(): CardContent {
    if (this.state.type === 'created') {
      throw new Error('Dont use this right now');
    }
    return {
      data: this.state.rawData,
      schemaModule: this.state.schemaModule,
      usedFields: this.state.usedFields,
      componentModule: this.state.componentModule,
      url: this.url,
      format: this.state.format,
    };
  }

  get component(): unknown {
    throw new Error('Hub does not have use of component');
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    if (this.state.type === 'created') {
      throw new Error('unimplemented');
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
        ({ raw, compiled } = await this.cardService.create({
          id: this.state.id,
          realm: this.state.realm,
          adoptsFrom: this.state.parentCardURL,
          data: serializeAttributes(cloneDeep(this._data), this.serializerMap),
        }));
        break;
      case 'loaded':
        // TODO let's use a bifurcated indexer so that we don't need to perform an unnecessary compile
        ({ raw, compiled } = await this.cardService.update({
          id: this.state.id,
          realm: this.state.realm,
          data: serializeAttributes(cloneDeep(this._data), this.serializerMap),
        }));
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
