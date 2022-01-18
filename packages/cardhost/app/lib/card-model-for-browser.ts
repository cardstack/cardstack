import {
  JSONAPIDocument,
  SerializerMap,
  Setter,
  CardEnv,
  Saved,
  Unsaved,
  ResourceObject,
  assertDocumentDataIsResource,
  CardContent,
  CardModel,
  RawCardData,
  Format,
} from '@cardstack/core/src/interfaces';
// import { tracked } from '@glimmer/tracking';
import { cloneDeep } from 'lodash';
import {
  deserializeAttributes,
  serializeAttributes,
  serializeResource,
} from '@cardstack/core/src/serializers';

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

export interface LoadedState {
  type: 'loaded';
  format: Format;
  url: string;
  serializerMap: SerializerMap;
  rawServerResponse: ResourceObject<Saved>;
  innerComponent: unknown;
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModelForBrowser implements CardModel {
  setters: Setter;
  private declare _data: any;
  private state: CreatedState | LoadedState;
  private wrapperComponent: unknown | undefined;

  constructor(
    private cards: CardEnv,
    state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>
  ) {
    if (state.type == 'created') {
      this.state = state;
    } else {
      this.state = {
        ...state,
        deserialized: false,
        original: undefined,
      };
    }
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

  adoptIntoRealm(realm: string): CardModel {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    return new (this.constructor as typeof CardModelForBrowser)(this.cards, {
      type: 'created',
      realm,
      parentCardURL: this.state.url,
      innerComponent: this.innerComponent,
      serializerMap: this.serializerMap,
    });
  }

  setData(_data: RawCardData) {
    throw new Error('unimplemented');
  }

  get innerComponent(): unknown {
    return this.state.innerComponent;
  }

  get serializerMap(): SerializerMap {
    return this.state.serializerMap;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(
        `bug: card in state ${this.state.type} does not have a url`
      );
    }
    return this.state.url;
  }

  get format(): Format {
    if (this.state.type === 'created') {
      return 'isolated';
    }
    return this.state.format;
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.load(
      this.state.url,
      'edit'
    )) as CardModelForBrowser;
    (editable.state as LoadedState).original = this;
    return editable;
  }

  get data(): any {
    switch (this.state.type) {
      case 'loaded':
        if (!this.state.deserialized) {
          this._data = deserializeAttributes(
            this.state.rawServerResponse.attributes,
            this.serializerMap
          );
          this.state.deserialized = true;
        }
        return this._data;
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
    throw new Error('Dont use this right now');
  }

  get component(): unknown {
    if (!this.wrapperComponent) {
      this.wrapperComponent = this.cards.prepareComponent(
        this,
        this.innerComponent
      );
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

  serialize(): ResourceObject<Saved | Unsaved> {
    throw new Error('unimplemented');
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
              // TODO use this.serialize
              data: serializeResource('card', undefined, attributes),
            },
          },
        });
        break;
      case 'loaded':
        original = this.state.original;
        response = await this.cards.send({
          update: {
            cardURL: this.state.url,
            payload: {
              // TODO use this.serialize
              data: serializeResource('card', this.state.url, attributes),
            },
          },
        });
        break;
      default:
        throw assertNever(this.state);
    }

    let { data } = response;
    assertDocumentDataIsResource(data);

    let { serializerMap, innerComponent } = this.state;

    this.state = {
      type: 'loaded',
      format: this.format,
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
