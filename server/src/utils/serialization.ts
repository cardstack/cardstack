import {
  ComponentInfo,
  RawCard,
  CompiledCard,
  FORMATS,
} from '@cardstack/core/src/interfaces';
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

let fieldSerializerConfig = {
  attributes: ['name', 'fieldType', 'card'],

  ref(parentCompiledCard, field) {
    return parentCompiledCard.url + '/' + field.name;
  },
};

let compiledCardSerializerConfig = {
  ref: 'url',
  attributes: [
    'schemaModule',
    'serializer',
    'fields',
    'adoptsFrom',
    ...FORMATS,
  ],
  fields: fieldSerializerConfig,
  transform(compiledCard) {
    debugger;
    return compiledCard;
  },
};
compiledCardSerializerConfig.adoptsFrom = compiledCardSerializerConfig;
fieldSerializerConfig.card = compiledCardSerializerConfig;

export function serializeRawCard(
  card: RawCard,
  compiled?: CompiledCard
): Promise<object> {
  let config: any = {
    id: 'url',
    attributes: [
      'schema',
      'isolated',
      'embedded',
      'edit',
      'deserializer',
      'adoptsFrom',
      'files',
      'data',
      'compiled-meta',
    ],
    'compiled-meta': compiledCardSerializerConfig,
    nullIfMissing: true,
    transform(compiledCard) {
      debugger;
      return compiledCard;
    },
    typeForAttribute: function (type: string) {
      if (type === 'adoptsFrom') {
        return 'compiled-meta';
      }
      return type;
    },
  };

  if (compiled) {
    card['compiled-meta'] = compiled;
  }

  let rawSerializer = new Serializer('raw-card', config);

  debugger;
  return rawSerializer.serialize(card);
}
