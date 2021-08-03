import {
  cardJSONReponse,
  ComponentInfo,
  SerializerMap,
  SerializerName,
  Setter,
} from './interfaces';
import serializers, {
  PrimitiveSerializer,
} from '@cardstack/core/src/serializers';
import { tracked } from '@glimmer/tracking';
import { cloneDeep } from 'lodash';

export interface newCardParams {
  realm: string;
  parentCardURL: string;
}

export default class CardModel {
  static serializerMap: SerializerMap;

  realm?: string;
  parentCardURL?: string;
  url!: string;

  setters: Setter;

  @tracked private _data: any;
  private rawServerResponse?: cardJSONReponse;
  private deserialized = false;

  constructor(params?: newCardParams) {
    this.setters = this.makeSetter();
    if (params) {
      this.realm = params.realm;
      this.parentCardURL = params.parentCardURL;
    }
  }

  static newFromResponse(cardResponse: cardJSONReponse): CardModel {
    let model = new this();
    model.updateFromResponse(cardResponse);
    return model;
  }

  static newFromParentCardResponse(
    klass: typeof CardModel,
    cardResponse: cardJSONReponse
  ): CardModel {
    let model = new klass();
    model.parentCardURL = cardResponse.data.id;
    return model;
  }

  get isNew() {
    return !this.url;
  }

  updateFromResponse(cardResponse: cardJSONReponse) {
    this.deserialized = false;
    this.rawServerResponse = cloneDeep(cardResponse);

    if (!this.url && cardResponse.data.id) {
      this.url = cardResponse.data.id;
    }

    this._data = null;
  }

  get data(): any {
    if (!this.deserialized) {
      this._data = this.deserialize();
      this.deserialized = true;
    }
    return this._data;
  }

  private deserialize(): any {
    if (!this.rawServerResponse) {
      return;
    }

    let { attributes } = this.rawServerResponse.data;
    return serializeAttributes(
      attributes,
      'deserialize',
      // @ts-ignore This works as expected, whats up typescript?
      this.constructor.serializerMap
    );
  }

  serialize(): cardJSONReponse {
    let { data, url } = this;
    let attributes = serializeAttributes(
      data,
      'serialize',
      // @ts-ignore
      this.constructor.serializerMap
    );

    return constructJSONAPIResponse(attributes, url);
  }

  static serialize(
    url: string,
    data: any,
    component: ComponentInfo
  ): cardJSONReponse {
    let attributes = serializeAttributes(data, 'serialize', this.serializerMap);

    return constructJSONAPIResponse(attributes, url, component.moduleName);
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
}

function constructJSONAPIResponse(
  attributes: any,
  url?: string,
  componentModule?: string
): cardJSONReponse {
  let response: cardJSONReponse = {
    data: {
      type: 'card',
      attributes,
    },
  };

  if (url) {
    response.data.id = url;
  }

  if (componentModule) {
    response.data.meta = {
      componentModule,
    };
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
