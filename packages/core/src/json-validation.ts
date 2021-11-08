import { CardstackError } from './utils/errors';

export function assertJSONValue(v: any, pointer: string[]) {
  if (v === null) {
    return;
  }
  switch (typeof v) {
    case 'string':
    case 'number':
    case 'boolean':
      return;
    case 'object':
      if (Array.isArray(v)) {
        v.every((value, index) => assertJSONValue(value, pointer.concat(`[${index}]`)));
      } else {
        Object.entries(v).every(([key, value]) => assertJSONValue(value, pointer.concat(key)));
      }
      return;
  }
  throw new CardstackError('value not allowed in json', {
    source: { pointer: pointer.join('/') },
    status: 400,
  });
}

export function assertJSONPrimitive(p: any, pointer: string[]) {
  if (p === null) {
    return;
  }
  switch (typeof p) {
    case 'string':
    case 'number':
    case 'boolean':
      return;
    default:
      throw new CardstackError('JSON primitive must be of type string, number, boolean, or null', {
        source: { pointer: pointer.join('/') },
        status: 400,
      });
  }
}
