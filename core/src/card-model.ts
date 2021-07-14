import {
  cardJSONReponse,
  CompiledCard,
  Format,
  SerializerMap,
  SerializerName,
  Setter,
} from './interfaces';
import serializers, {
  PrimitiveSerializer,
} from '@cardstack/core/src/serializers';
import { tracked } from '@glimmer/tracking';
import { cloneDeep } from 'lodash';

export default class CardModel {
  static serializerMap: SerializerMap;

  url: string;
  setters: Setter;

  @tracked private _data: any;
  private cardResponse: cardJSONReponse;
  private deserialized = false;

  constructor(cardResponse: cardJSONReponse) {
    this.cardResponse = cloneDeep(cardResponse);
    this.url = cardResponse.data.id;
    this.setters = this.makeSetter();
  }

  updateFromResponse(cardResponse: cardJSONReponse) {
    this.deserialized = false;
    this.cardResponse = cloneDeep(cardResponse);
    this._data = null;
  }

  get data(): any {
    if (!this.deserialized) {
      let data = this.deserialize();
      this._data = data;
      this.deserialized = true;
    }
    return this._data;
  }

  private deserialize(): any {
    let { attributes } = this.cardResponse.data;
    return serializeAttributes(
      attributes,
      'deserialize',
      // @ts-ignore
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

    return constructJSONAPIResponse(url, attributes);
  }

  static serialize(card: CompiledCard, format: Format): cardJSONReponse {
    let attributes = serializeAttributes(
      card.data,
      'serialize',
      this.serializerMap
    );

    return constructJSONAPIResponse(
      card.url,
      attributes,
      card[format].moduleName
    );
  }

  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        this._data = value;
        return;
      }
      let data = this._data;
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
  url: string,
  attributes: any,
  componentModule?: string
): cardJSONReponse {
  let response: cardJSONReponse = {
    data: {
      id: url,
      type: 'card',
      attributes,
    },
  };
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
