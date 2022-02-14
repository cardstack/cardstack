/* eslint-disable @typescript-eslint/naming-convention */
import * as JSON from 'json-typescript';
import { parseISO, parse, format } from 'date-fns';
import set from 'lodash/set';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
import { ResourceObject, Saved, SerializerMap, Unsaved, PrimitiveSerializer, ComponentInfo } from '../interfaces';
import { keys } from '../utils';
import { pick } from 'lodash';

export { RawCardDeserializer } from './raw-card-deserializer';
export { RawCardSerializer } from './raw-card-serializer';

const DateTimeSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
    // If the model hasn't been deserialized yet it will still be a string
    if (typeof d === 'string') {
      return d;
    }
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

export const SERIALIZERS = {
  DateTimeSerializer: DateTimeSerializer,
  DateSerializer: DateSerializer,
};

export function serializeField(
  serializerMap: SerializerMap,
  fieldPath: string,
  value: any,
  action: 'serialize' | 'deserialize'
) {
  if (!value) {
    return;
  }
  let serializer = get(serializerMap, fieldPath);
  if (serializer) {
    return serializer[action](value);
  }

  return value;
}

export function deserializeAttributes(attrs: any, serializerMap: SerializerMap): JSON.Object {
  return serializeAttributes(attrs, serializerMap, 'deserialize');
}

export function serializeAttributes(
  attrs: any,
  serializerMap: SerializerMap,
  action: 'serialize' | 'deserialize' = 'serialize'
): JSON.Object {
  let attributes = cloneDeep(attrs);

  for (let field of keys(serializerMap)) {
    let rawValue = get(attributes, field);
    if (typeof rawValue === 'undefined') {
      continue;
    }
    let value = serializeField(serializerMap, field, rawValue, action);
    set(attributes, field, value);
  }

  return attributes;
}

export function serializeCardAsResource<Identity extends Saved | Unsaved>(
  url: Identity,
  payload: object,
  serializerMap: SerializerMap,
  usedFields?: ComponentInfo['usedFields']
): ResourceObject<Identity> {
  let data = usedFields ? pick(payload, usedFields) : payload;
  let attributes = serializeAttributes(data, serializerMap);

  return {
    id: url,
    type: 'card',
    attributes,
  };
}

//

export function findIncluded(doc: any, ref: { type: string; id: string }) {
  return doc.included?.find((r: any) => r.id === ref.id && r.type === ref.type);
}
