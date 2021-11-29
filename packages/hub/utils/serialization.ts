import { ComponentInfo, RawCard, CompiledCard, Field } from '@cardstack/core/src/interfaces';
import type { CardJSONResponse } from '@cardstack/core/src/interfaces';
import { findIncluded } from '@cardstack/core/src/jsonapi';
import { PgPrimitive } from './expressions';

import _mapKeys from 'lodash/mapKeys';
import _camelCase from 'lodash/camelCase';
import merge from 'lodash/merge';
import set from 'lodash/set';
import get from 'lodash/get';

export async function serializeCard(
  url: string,
  data: RawCard['data'],
  component: ComponentInfo
): Promise<CardJSONResponse> {
  let resource = serializeResource('card', url, component.usedFields, data);
  resource.meta = merge(
    {
      componentModule: component.moduleName,
    },
    resource.meta
  );
  return { data: resource };
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

function serializeResource(
  type: string,
  id: string,
  attributes: (string | Record<string, string>)[],
  payload: any
): any {
  let resource: any = {
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

export function serializeRawCard(card: RawCard, compiled?: CompiledCard): PgPrimitive {
  let resource = serializeResource(
    'raw-cards',
    card.url,
    ['schema', 'isolated', 'embedded', 'edit', 'deserializer', 'adoptsFrom', 'files', 'data'],
    card
  );
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
  if (!findIncluded(doc, { type: 'compiled-metas', id: compiled.url })) {
    let resource = serializeResource(
      'compiled-metas',
      compiled.url,
      ['schemaModule', 'serializer', 'isolated', 'embedded', 'edit'],
      compiled
    );
    doc.included.push(resource);
    if (compiled.adoptsFrom) {
      resource.relationships.adoptsFrom = {
        data: includeCompiledMeta(compiled.adoptsFrom, doc),
      };
    }
    resource.relationships.fields = {
      data: Object.values(compiled.fields).map((field) => includeField(compiled, field, doc)),
    };
  }
  return { type: 'compiled-metas', id: compiled.url };
}

function includeField(parent: CompiledCard, field: Field, doc: any) {
  let id = `${parent.url}/${field.name}`;
  if (!findIncluded(doc, { type: 'fields', id })) {
    let resource = serializeResource('fields', id, ['name', { fieldType: 'type' }], field);
    doc.included.push(resource);
    resource.relationships.card = {
      data: includeCompiledMeta(field.card, doc),
    };
  }
  return { type: 'fields', id };
}
