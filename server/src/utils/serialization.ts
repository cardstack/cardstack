import { ComponentInfo, RawCard } from '@cardstack/core/src/interfaces';
import type { CardJSONResponse } from '@cardstack/core/src/interfaces';
import { Serializer } from 'jsonapi-serializer';
import _mapKeys from 'lodash/mapKeys';
import _camelCase from 'lodash/camelCase';

export async function serializeCard(
  url: string,
  data: RawCard['data'],
  component: ComponentInfo
): Promise<CardJSONResponse> {
  let cardSerializer = new Serializer('card', {
    attributes: component.usedFields,
    keyForAttribute: 'camelCase',
    dataMeta: {
      componentModule: component.moduleName,
    },
  });
  return cardSerializer.serialize(Object.assign({ id: url }, data));
}

export function deserialize(payload: any): any {
  let data = payload;

  if (data.data) {
    data = data.data;
  }

  if (data) {
    data = _mapKeys(data, (_val, key) => _camelCase(key));
  }

  return data;
}
