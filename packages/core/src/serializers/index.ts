/* eslint-disable @typescript-eslint/naming-convention */
import { parseISO, parse, format } from 'date-fns';
import merge from 'lodash/merge';
import set from 'lodash/set';
import get from 'lodash/get';
import {
  ResourceObject,
  Saved,
  JSONAPIDocument,
  SerializerMap,
  SerializerName,
  Unsaved,
  CardContent,
} from '../interfaces';

export { RawCardDeserializer } from './raw-card-deserializer';
export { RawCardSerializer } from './raw-card-serializer';

export interface PrimitiveSerializer {
  serialize(val: any): any;
  deserialize(val: any): any;
}

const DateTimeSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
    return d.toISOString();
  },
  deserialize(d: string): Date {
    return parseISO(d);
  },
};

const DateSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
    // If the model hasn't been deserialized yet it will still be a string
    if (typeof d === 'string') {
      return d;
    }
    return format(d, 'yyyy-MM-dd');
  },
  deserialize(d: string): Date {
    return parse(d, 'yyyy-MM-dd', new Date());
  },
};

const SERIALIZERS = {
  datetime: DateTimeSerializer,
  date: DateSerializer,
};

export function deserializaAttributes(attrs: { [name: string]: any } | undefined, serializerMap: SerializerMap) {
  return _serializeAttributes(attrs, 'deserialize', serializerMap);
}

export function serializeAttributes(attrs: { [name: string]: any } | undefined, serializerMap: SerializerMap) {
  return _serializeAttributes(attrs, 'serialize', serializerMap);
}

function _serializeAttributes(
  attrs: { [name: string]: any } | undefined,
  action: 'serialize' | 'deserialize',
  serializerMap: SerializerMap
): any {
  if (!attrs) {
    return;
  }
  let serializerName: SerializerName;
  for (serializerName in serializerMap) {
    let serializer = SERIALIZERS[serializerName];
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

export function serializeCardPayloadForFormat(card: CardContent): JSONAPIDocument<Saved> {
  let componentInfo = card[card.format];
  let resource = serializeResource('card', card.url, card.data, componentInfo.usedFields);
  resource.meta = merge(
    {
      componentModule: componentInfo.moduleName.global,
    },
    resource.meta
  );
  return { data: resource };
}

export function serializeResource<Identity extends Saved | Unsaved>(
  type: string,
  id: Identity,
  payload: any,
  attributes?: (string | Record<string, string>)[]
): ResourceObject<Identity> {
  let resource: ResourceObject<Identity> = {
    id,
    type,
  };
  resource.attributes = {};

  if (!attributes) {
    attributes = Object.keys(payload);
  }

  for (const attr of attributes) {
    if (typeof attr === 'object') {
      let [aliasName, name] = Object.entries(attr)[0];
      set(resource.attributes, aliasName, get(payload, name) ?? null);
    } else {
      set(resource.attributes, attr, get(payload, attr) ?? null);
    }
  }
  return resource;
}

export function findIncluded(doc: any, ref: { type: string; id: string }) {
  return doc.included?.find((r: any) => r.id === ref.id && r.type === ref.type);
}
