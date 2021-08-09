import {
  CardJSONRequest,
  CardJSONResponse,
  SerializerMap,
  SerializerName,
  Setter,
  CardEnv,
} from '@cardstack/core/src/interfaces';
import serializers, {
  PrimitiveSerializer,
} from '@cardstack/core/src/serializers';
// import { tracked } from '@glimmer/tracking';
import { cloneDeep } from 'lodash';

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
  rawServerResponse: CardJSONResponse;
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModel {
  static serializerMap: SerializerMap;
  setters: Setter;
  // @tracked private _data: any = {};

  constructor(
    private cards: CardEnv,
    private innerComponent: unknown,
    private state: CreatedState | LoadedState
  ) {
    this.setters = this.makeSetter();
  }

  static newFromResponse(
    cards: CardEnv,
    cardResponse: CardJSONResponse,
    component: unknown
  ): CardModel {
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
    throw new Error(
      `bug: card in state ${this.state.type} does not have a url`
    );
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
    return new (this.constructor as typeof CardModel)(
      this.cards,
      this.innerComponent,
      {
        type: 'created',
        realm,
        parentCardURL: this.state.url,
      }
    );
  }

  get data(): any {
    switch (this.state.type) {
      case 'loaded':
        if (!this.state.deserialized) {
          this._data = this.deserialize(this.state);
          this.state.deserialized = true;
        }
        return this._data;
      case 'created':
        return this._data;
      default:
        throw assertNever(this.state);
    }
  }

  private wrapperComponent: unknown | undefined;

  get component(): unknown {
    if (!this.wrapperComponent) {
      this.wrapperComponent = this.cards.prepareComponent(
        this.innerComponent,
        this.data,
        this.setters
      );
    }
    return this.wrapperComponent;
  }

  private deserialize(state: LoadedState): any {
    let { attributes } = state.rawServerResponse.data;
    return serializeAttributes(
      attributes,
      'deserialize',
      // @ts-ignore This works as expected, whats up typescript?
      this.constructor.serializerMap
    );
  }

  private serialize(): CardJSONRequest {
    let { data } = this;
    let attributes = serializeAttributes(
      data,
      'serialize',
      // @ts-ignore
      this.constructor.serializerMap
    );

    let url: string | undefined;
    if (this.state.type === 'loaded') {
      url = this.state.url;
    }

    return constructJSONAPIRequest(attributes, url);
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
        get: (target: object, prop: string, receiver: unknown) => {
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
    let body = JSON.stringify(this.serialize());
    let url, method, original;
    switch (this.state.type) {
      case 'created':
        url = this.cards.buildNewURL(
          this.state.realm,
          this.state.parentCardURL
        );
        method = 'POST';
        break;
      case 'loaded':
        url = this.cards.buildCardURL(this.state.url);
        method = 'PATCH';
        original = this.state.original;
        break;
      default:
        throw assertNever(this.state);
    }
    let response = await this.cards.fetchJSON(url, {
      method,
      body,
    });
    this.state = {
      type: 'loaded',
      url: response.data.id,
      rawServerResponse: cloneDeep(response),
      deserialized: false,
      original,
    };
  }
}

function constructJSONAPIRequest(
  attributes: any,
  url: string | undefined
): CardJSONRequest {
  let response: CardJSONRequest = {
    data: {
      type: 'card',
      attributes,
    },
  };

  if (url) {
    response.data.id = url;
  }

  return response;
}

function serializeAttributes(
  attrs: { [name: string]: any } | undefined,
  action: 'serialize' | 'deserialize',
  serializerMap: SerializerMap
): any {
  if (!attrs) {
    return;
  }
  let serializerName: SerializerName;
  for (serializerName in serializerMap) {
    let serializer = serializers[serializerName];
    let paths = serializerMap[serializerName];
    if (!paths) {
      continue;
    }
    for (const path of paths) {
      serializeAttribute(attrs, path, serializer, action);
    }
  }

  return attrs;
}

function serializeAttribute(
  attrs: { [name: string]: any },
  path: string,
  serializer: PrimitiveSerializer,
  action: 'serialize' | 'deserialize'
) {
  let [key, ...tail] = path.split('.');
  let value = attrs[key];
  if (!value) {
    return;
  }

  if (tail.length) {
    let tailPath = tail.join('.');
    if (Array.isArray(value)) {
      for (let row of value) {
        serializeAttribute(row, tailPath, serializer, action);
      }
    } else {
      serializeAttribute(attrs[key], tailPath, serializer, action);
    }
  } else {
    attrs[path] = serializer[action](value);
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
