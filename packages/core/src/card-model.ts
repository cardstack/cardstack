import { JSONAPIDocument, SerializerMap, Setter, CardEnv, Saved } from './interfaces';
// import { tracked } from '@glimmer/tracking';
import { cloneDeep } from 'lodash';
import { deserializaAttributes, serializeAttributes, serializeResource } from './serializers';

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  realm: string;
  parentCardURL: string;
}

export interface LoadedState {
  type: 'loaded';
  url: string;
  rawServerResponse: JSONAPIDocument<Saved>;
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModel {
  static serializerMap: SerializerMap;
  setters: Setter;
  private declare _data: any;

  constructor(private cards: CardEnv, private innerComponent: unknown, private state: CreatedState | LoadedState) {
    this.setters = this.makeSetter();
    Object.defineProperty(
      this,
      '_data',
      cards.tracked(this, '_data', {
        enumerable: true,
        writable: true,
        configurable: true,
      })
    );
  }

  static fromResponse(cards: CardEnv, cardResponse: JSONAPIDocument<Saved>, component: unknown): CardModel {
    return new this(cards, component, {
      type: 'loaded',
      url: cardResponse.data.id,
      rawServerResponse: cloneDeep(cardResponse),
      deserialized: false,
      original: undefined,
    });
  }

  get url(): string {
    if (this.state.type === 'loaded') {
      return this.state.url;
    }
    throw new Error(`bug: card in state ${this.state.type} does not have a url`);
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = await this.cards.load(this.state.url, 'edit');
    (editable.state as LoadedState).original = this;
    return editable;
  }

  adoptIntoRealm(realm: string): CardModel {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    return new (this.constructor as typeof CardModel)(this.cards, this.innerComponent, {
      type: 'created',
      realm,
      parentCardURL: this.state.url,
    });
  }

  get data(): any {
    switch (this.state.type) {
      case 'loaded':
        if (!this.state.deserialized) {
          this._data = deserializaAttributes(
            this.state.rawServerResponse.data.attributes,
            // @ts-ignore This works as expected, whats up typescript?
            this.constructor.serializerMap
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

  get serializedAttributes() {
    return serializeAttributes(
      this.data,
      // @ts-ignore
      this.constructor.serializerMap
    );
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

    switch (this.state.type) {
      case 'created':
        response = await this.cards.send({
          create: {
            targetRealm: this.state.realm,
            parentCardURL: this.state.parentCardURL,
            payload: {
              data: serializeResource('card', undefined, this.serializedAttributes),
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
              data: serializeResource('card', this.state.url, this.serializedAttributes),
            },
          },
        });
        break;
      default:
        throw assertNever(this.state);
    }

    this.state = {
      type: 'loaded',
      url: response.data.id,
      rawServerResponse: cloneDeep(response),
      deserialized: false,
      original,
    };
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
