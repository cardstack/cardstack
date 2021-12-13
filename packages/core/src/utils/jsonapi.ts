import set from 'lodash/set';
import get from 'lodash/get';

export interface ResourceObject {
  id?: string;
  type: string;
  attributes?: { [name: string]: any };
  relationships?: { [name: string]: any };
  meta?: { [name: string]: any };
}

export function serializeResource(
  type: string,
  id: string,
  attributes: (string | Record<string, string>)[],
  payload: any
): ResourceObject {
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
