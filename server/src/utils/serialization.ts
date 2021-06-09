import type { cardJSONReponse } from '@cardstack/server/src/interfaces';
import type { CompiledCard, Format } from '@cardstack/core/src/interfaces';
import { Serializer } from 'jsonapi-serializer';
import _mapKeys from 'lodash/mapKeys';
import _camelCase from 'lodash/camelCase';

export async function serializeCard(
  card: CompiledCard,
  format: Format
): Promise<cardJSONReponse> {
  let cardSerializer = new Serializer('card', {
    attributes: card[format].usedFields,
    dataMeta: {
      componentModule: card[format].moduleName,
      deserializationMap: card[format].deserialize,
    },
  });
  let data = Object.assign({ id: card.url }, card.data);
  return cardSerializer.serialize(data);
}

export function deserialize(payload: any): any {
  let data = payload;

  if (data.data) {
    data = data.data;
  }

  if (data) {
    data = _mapKeys(data, (val, key) => _camelCase(key));
  }

  return data;
}
