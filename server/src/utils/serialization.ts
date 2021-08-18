import {
  ComponentInfo,
  RawCard,
  CompiledCard,
  Field,
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

export function serializeRawCard(
  card: RawCard,
  compiled?: CompiledCard
): Promise<object> {
  let resource: any = {
    type: 'raw-cards',
    id: card.url,
    attributes: {
      schema: card.schema ?? null,
      isolated: card.isolated ?? null,
      embedded: card.embedded ?? null,
      edit: card.edit ?? null,
      deserializer: card.deserializer ?? null,
      adoptsFrom: card.adoptsFrom ?? null,
      files: card.files ?? null,
      data: card.data ?? null,
    },
  };
  let doc: any = { data: resource };

  if (compiled) {
    doc.included = [];
    resource.relationships = {
      compiledMeta: { data: includeCompiledMeta(compiled, doc) },
    };
  }
  return doc;
}

function includeCompiledMeta(compiled: CompiledCard, doc: any) {
  if (
    !doc.included.find(
      (entry: any) =>
        entry.type === 'compiled-metas' && entry.id === compiled.url
    )
  ) {
    let resource = {
      type: 'compiled-metas',
      id: compiled.url,
      attributes: {
        schemaModule: compiled.schemaModule,
        serializer: compiled.serializer,
        isolated: compiled.isolated,
        embedded: compiled.embedded,
        edit: compiled.edit,
      },
      relationships: {} as any,
    };
    doc.included.push(resource);
    if (compiled.adoptsFrom) {
      resource.relationships.adoptsFrom = {
        data: includeCompiledMeta(compiled.adoptsFrom, doc),
      };
    }
    resource.relationships.fields = {
      data: Object.values(compiled.fields).map((field) =>
        includeField(compiled, field, doc)
      ),
    };
  }
  return { type: 'compiled-metas', id: compiled.url };
}

function includeField(parent: CompiledCard, field: Field, doc: any) {
  let id = `${parent.url}/${field.name}`;
  if (
    !doc.included.find(
      (entry: any) => entry.type === 'fields' && entry.id === id
    )
  ) {
    let resource = {
      type: 'fields',
      id,
      attributes: {
        name: field.name,
        fieldType: field.type,
      },
      relationships: {} as any,
    };
    doc.included.push(resource);
    resource.relationships.card = {
      data: includeCompiledMeta(field.card, doc),
    };
  }
  return { type: 'fields', id };
}
