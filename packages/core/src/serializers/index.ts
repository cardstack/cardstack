/* eslint-disable @typescript-eslint/naming-convention */
import * as JSON from 'json-typescript';
import set from 'lodash/set';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
import { ResourceObject, Saved, SerializerMap, Unsaved, ComponentInfo } from '../interfaces';
import { keys } from '../utils';
import { pick } from 'lodash';

export { RawCardDeserializer } from './raw-card-deserializer';
export { RawCardSerializer } from './raw-card-serializer';

export function serializeField(
  serializerMap: SerializerMap,
  fieldPath: string,
  value: any,
  action: 'serialize' | 'deserialize'
) {
  // missing field
  if (value === undefined) {
    return;
  }
  // empty field
  if (value === null) {
    return null;
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
  action: 'serialize' | 'deserialize' = 'serialize',
  fields?: string[]
): JSON.Object {
  let attributes = fields ? pick(attrs, fields) : cloneDeep(attrs);

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
