/* eslint-disable @typescript-eslint/naming-convention */
import { parseISO, parse, format } from 'date-fns';
import merge from 'lodash/merge';
import set from 'lodash/set';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
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


export function deserializeAttributes(attrs: { [name: string]: any } | undefined, serializerMap: SerializerMap) {
  return _serializeAttributes(cloneDeep(attrs), 'deserialize', serializerMap);
}

export function serializeAttributes(attrs: { [name: string]: any } | undefined, serializerMap: SerializerMap) {
  return _serializeAttributes(cloneDeep(attrs), 'serialize', serializerMap);
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

// TEMP: This is here to support the future layout of the serializerMaps that will eventually be
// built into the component
export function inversedSerializerMap(serializerMap: SerializerMap): Record<string, SerializerName> {
  let inversedMap: Record<string, SerializerName> = {};
  for (const type of Object.keys(serializerMap) as SerializerName[]) {
    for (const key of serializerMap[type] || []) {
      inversedMap[key] = type;
    }
  }
  return inversedMap;
}

export function serializeCardPayloadForFormat(card: CardContent): JSONAPIDocument<Saved> {
  let { usedFields, componentModule } = card;
  let resource = serializeResource('card', card.url, card.data, usedFields);
  resource.meta = merge(
    {
      componentModule,
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
