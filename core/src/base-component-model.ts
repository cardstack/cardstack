import {
  cardJSONReponse,
  SerializerMap,
  SerializerName,
  Setter,
} from './interfaces';
import serializers, {
  PrimitiveSerializer,
} from '@cardstack/core/src/serializers';
import { tracked } from '@glimmer/tracking';

export default class CardModel {
  @tracked private _data: any;
  url: string;
  serializerMap!: SerializerMap;
  setters: Setter;
  private cardResponse: cardJSONReponse;
  private deserialized = false;

  constructor(cardResponse: cardJSONReponse) {
    this.cardResponse = cardResponse;
    this.url = cardResponse.data.id;
    this.setters = this.makeSetter();
  }

  updateFromResponse(cardResponse: cardJSONReponse) {
    this.deserialized = false;
    this.cardResponse = cardResponse;
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
    return this.serializeAttributes(attributes, 'deserialize');
  }

  serialize() {
    let { data, url } = this;
    let attributes = this.serializeAttributes(data, 'serialize');

    return {
      data: {
        type: 'card',
        id: url,
        attributes,
      },
    };
  }

  private serializeAttributes(
    attrs: cardJSONReponse['data']['attributes'],
    action: 'serialize' | 'deserialize'
  ): any {
    if (!attrs) {
      return;
    }
    let attributes = Object.assign({}, attrs);

    let serializerName: SerializerName;
    for (serializerName in this.serializerMap) {
      let serializer = serializers[serializerName];
      let paths = this.serializerMap[serializerName];
      if (!paths) {
        continue;
      }
      for (const path of paths) {
        serializeAttribute(attributes, path, serializer, action);
      }
    }

    return attributes;
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
