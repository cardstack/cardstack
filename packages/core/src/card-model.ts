import {
  JSONAPIDocument,
  SerializerMap,
  Setter,
  CardEnv,
  Saved,
  ResourceObject,
  assertDocumentDataIsResource,
  CompiledCard,
  ComponentInfo,
  RawCard,
  Format,
  CardContent,
} from './interfaces';
// import { tracked } from '@glimmer/tracking';
import { cloneDeep } from 'lodash';
import { deserializeAttributes, serializeAttributes, serializeResource } from './serializers';

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  realm: string;
  parentCardURL: string;
  innerComponent: unknown;
  serializerMap: SerializerMap;
}

export interface ClientLoadedState {
  type: 'client-loaded';
  url: string;
  serializerMap: SerializerMap;
  rawServerResponse: ResourceObject<Saved>;
  innerComponent: unknown;
  deserialized: boolean;
  original: CardModel | undefined; // This looks unused? Can we remove?
}

interface HubLoadedState {
  type: 'hub-loaded';
  url: string;
  format: Format;
  serializerMap: SerializerMap;
  rawData: NonNullable<RawCard['data']>;
  schemaModule: CompiledCard['schemaModule']['global'];
  componentModule: ComponentInfo['moduleName']['global'];
  usedFields: ComponentInfo['usedFields'];
}

export default class CardModel {
  setters: Setter;
  private declare _data: any;

  private constructor(private cards: CardEnv, private state: CreatedState | ClientLoadedState | HubLoadedState) {
    this.setters = this.makeSetter();
    let prop = cards.tracked(this, '_data', {
      enumerable: true,
      writable: true,
      configurable: true,
    });
    if (prop) {
      Object.defineProperty(this, '_data', prop);
    }
  }

  static fromResponse(
    cards: CardEnv,
    cardResponse: ResourceObject,
    innerComponent: unknown,
    serializerMap: SerializerMap
  ): CardModel {
    return new this(cards, {
      type: 'client-loaded',
      url: cardResponse.id,
      rawServerResponse: cloneDeep(cardResponse),
      deserialized: false,
      original: undefined,
      innerComponent,
      serializerMap,
    });
  }

  static fromDatabase(cards: CardEnv, format: Format, result: Record<string, any>): CardModel {
    if (!result.componentInfos) {
      debugger;
    }
    return new this(cards, {
      type: 'hub-loaded',
      url: result.url,
      format,
      rawData: result.data ?? {},
      schemaModule: result.schemaModule,
      usedFields: result.componentInfos[format].usedFields,
      componentModule: result.componentInfos[format].moduleName.global,
      serializerMap: result.componentInfos[format].serializerMap,
    });
  }

  adoptIntoRealm(realm: string): CardModel {
    if (this.state.type !== 'client-loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    return new (this.constructor as typeof CardModel)(this.cards, {
      type: 'created',
      realm,
      parentCardURL: this.state.url,
      innerComponent: this.innerComponent,
      serializerMap: this.serializerMap,
    });
  }

  get innerComponent(): unknown {
    if (this.state.type === 'hub-loaded') {
      throw new Error('Hub does not have use of innerComponent');
    }
    return this.state.innerComponent;
  }

  get serializerMap(): SerializerMap {
    return this.state.serializerMap;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(`bug: card in state ${this.state.type} does not have a url`);
    }
    return this.state.url;
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'client-loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = await this.cards.load(this.state.url, 'edit');
    (editable.state as ClientLoadedState).original = this;
    return editable;
  }

  get data(): any {
    switch (this.state.type) {
      case 'client-loaded':
        if (!this.state.deserialized) {
          this._data = deserializeAttributes(this.state.rawServerResponse.attributes, this.serializerMap);
          this.state.deserialized = true;
        }
        return this._data;
      case 'hub-loaded':
        return this.state.rawData;
      case 'created':
        return this._data;
      default:
        throw assertNever(this.state);
    }
  }

  /**
   * @deprecated temporary scaffolding until card-service's CardContent => CardModel
   * refactor complete. Consumers of CardModel should be refactored to use `data`
   * and other TBD methods instead of this.
   */
  get cardContent(): CardContent {
    if (this.state.type === 'created' || this.state.type === 'client-loaded') {
      throw new Error('Dont use this right now');
    }
    return {
      data: this.state.rawData,
      schemaModule: this.state.schemaModule,
      usedFields: this.state.usedFields,
      componentModule: this.state.componentModule,
      url: this.state.url,
      format: this.state.format,
    };
  }

  private wrapperComponent: unknown | undefined;

  get component(): unknown {
    if (!this.wrapperComponent) {
      this.wrapperComponent = this.cards.prepareComponent(this, this.innerComponent);
    }
    return this.wrapperComponent;
  }

  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        this._data = value;
        return;
      }
      let data = this._data || {};
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
      this._data = data;
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

  async save(): Promise<void> {
    let response: JSONAPIDocument<Saved>;
    let original: CardModel | undefined;
    let attributes = serializeAttributes(this.data, this.serializerMap);

    switch (this.state.type) {
      case 'created':
        response = await this.cards.send({
          create: {
            targetRealm: this.state.realm,
            parentCardURL: this.state.parentCardURL,
            payload: {
              data: serializeResource('card', undefined, attributes),
            },
          },
        });
        break;
      case 'client-loaded':
        original = this.state.original;
        response = await this.cards.send({
          update: {
            cardURL: this.state.url,
            payload: {
              data: serializeResource('card', this.state.url, attributes),
            },
          },
        });
        break;
      case 'hub-loaded':
        throw new Error('unimplemented');
      default:
        throw assertNever(this.state);
    }

    let { data } = response;
    assertDocumentDataIsResource(data);

    let { serializerMap, innerComponent } = this.state;

    this.state = {
      type: 'client-loaded',
      url: data.id,
      rawServerResponse: cloneDeep(data),
      deserialized: false,
      original,
      serializerMap,
      innerComponent,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
