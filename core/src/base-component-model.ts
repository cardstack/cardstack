import {
  cardJSONReponse,
  SerializerMap,
  SerializerName,
  Setter,
} from './interfaces';
import { set } from '@ember/object';
import serializers, {
  PrimitiveSerializer,
} from '@cardstack/core/src/serializers';

export default class ComponentModel {
  _data: any;
  url: string;
  serializerMap!: SerializerMap;
  setters: Setter;
  private cardResponse: cardJSONReponse;

  constructor(cardResponse: cardJSONReponse) {
    this.cardResponse = cardResponse;
    this.url = cardResponse.data.id;
    this.setters = makeSetter((segments, value) => {
      set(this._data, segments.join('.'), value);
    });
  }

  updateFromResponse(cardResponse: cardJSONReponse) {
    this.cardResponse = cardResponse;
    this._data = this.deserialize();
  }

  get data(): any {
    if (this._data) {
      return this._data;
    } else {
      let data = this.deserialize();
      this._data = data;
      return data;
    }
  }

  deserialize(): any {
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
        deserializeAttribute(attributes, path, serializer, action);
      }
    }

    return attributes;
  }
}

function makeSetter(
  callback: (segments: string[], value: any) => void,
  segments: string[] = []
): Setter {
  let s = (value: any) => {
    callback(segments, value);
  };
  (s as any).setters = new Proxy(
    {},
    {
      get: (target: object, prop: string, receiver: unknown) => {
        if (typeof prop === 'string') {
          return makeSetter(callback, [...segments, prop]);
        } else {
          return Reflect.get(target, prop, receiver);
        }
      },
    }
  );

  return s;
}

function deserializeAttribute(
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
        deserializeAttribute(row, tailPath, serializer, action);
      }
    } else {
      deserializeAttribute(attrs[key], tailPath, serializer, action);
    }
  } else {
    attrs[path] = serializer[action](value);
  }
}
