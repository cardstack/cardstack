import { ComponentInfo, RawCard, CompiledCard, Field } from '@cardstack/core/src/interfaces';
import type { CardJSONResponse } from '@cardstack/core/src/interfaces';
import { Serializer, SerializerOptions } from 'jsonapi-serializer';
import _mapKeys from 'lodash/mapKeys';
import _camelCase from 'lodash/camelCase';
import mergeWith from 'lodash/mergeWith';
import uniq from 'lodash/uniq';
import { findIncluded } from '@cardstack/core/src/jsonapi';

export async function serializeCards(..._args: any[]) {
  throw new Error('Method not implemented.');
}

export async function serializeCard(
  url: string,
  data: RawCard['data'],
  component: ComponentInfo
): Promise<CardJSONResponse> {
  let cardSerializer = new Serializer('card', {
    ...convertUsedFields(component.usedFields),
    keyForAttribute: 'camelCase',
    dataMeta: {
      componentModule: component.moduleName,
    },
  });
  return cardSerializer.serialize(Object.assign({ id: url }, data));
}

function mergeWithUniq(dest: Record<string, unknown>, ...srcs: Record<string, unknown>[]) {
  return mergeWith(dest, ...srcs, appendArraysUniq);
}

function appendArraysUniq(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return uniq(objValue.concat(srcValue));
  }
  return undefined;
}

function convertUsedFields(usedFields: string[]): SerializerOptions {
  let result: SerializerOptions = {
    attributes: [],
  };
  for (let fieldName of usedFields) {
    let [first, ...rest] = fieldName.split('.');
    result.attributes!.push(first);
    if (rest.length > 0) {
      result[first] = mergeWithUniq({}, result[first], convertUsedFields([rest.join('.')]));
    }
  }
  return result;
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
      resource.attributes[aliasName] = payload[name] ?? null;
    } else {
      resource.attributes[attr] = payload[attr] ?? null;
    }
  }
  return resource;
}

export function serializeRawCard(card: RawCard, compiled?: CompiledCard): Promise<Record<string, unknown>> {
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
