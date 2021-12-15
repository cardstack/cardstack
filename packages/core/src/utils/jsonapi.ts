import set from 'lodash/set';
import get from 'lodash/get';
import { ResourceObject, Saved, Unsaved } from '../interfaces';

export function serializeResource(
  type: string,
  id: string | undefined,
  attributes: (string | Record<string, string>)[],
  payload: any
): ResourceObject<Saved | Unsaved> {
  let resource = {
    id,
    type,
    attributes: {},
    relationships: {},
  };

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
