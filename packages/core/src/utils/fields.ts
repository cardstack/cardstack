import { TemplateUsageMeta } from '../glimmer-plugin-card-template';
import { CardSchema, CompiledCard, ComponentInfo, Field, Format, RawCardData } from '../interfaces';
import { isNotReadyError } from './errors';
import set from 'lodash/set';
import get from 'lodash/get';
import isPlainObject from 'lodash/isPlainObject';

export function getFieldForPath(fields: CompiledCard['fields'], path: string): Field | undefined {
  let paths = path.split('.');
  let [first, ...tail] = paths;

  let field = fields[first];

  if (paths.length > 1) {
    return getFieldForPath(field.card.fields, tail.join('.'));
  }

  return field;
}

export function buildUsedFieldsListFromUsageMeta(
  fields: CompiledCard['fields'],
  usageMeta: TemplateUsageMeta
): ComponentInfo['usedFields'] {
  let usedFields: Set<string> = new Set();

  if (usageMeta.model && usageMeta.model !== 'self') {
    for (const fieldPath of usageMeta.model) {
      usedFields.add(fieldPath);
    }
  }

  for (const [fieldPath, fieldFormat] of usageMeta.fields.entries()) {
    buildUsedFieldListFromComponents(usedFields, fieldPath, fields, fieldFormat);
  }

  return [...usedFields];
}
function buildUsedFieldListFromComponents(
  usedFields: Set<string>,
  fieldPath: string,
  fields: CompiledCard['fields'],
  format: Format,
  prefix?: string
): void {
  let field = getFieldForPath(fields, fieldPath);

  if (field && field.card.componentInfos[format].usedFields.length) {
    for (const nestedFieldPath of field.card.componentInfos[format].usedFields) {
      buildUsedFieldListFromComponents(usedFields, nestedFieldPath, field.card.fields, 'embedded', fieldPath);
    }
  } else {
    if (prefix) {
      usedFields.add(`${prefix}.${fieldPath}`);
    } else {
      usedFields.add(fieldPath);
    }
  }
}
export async function getFieldValue(schemaInstance: any, fieldName: string): Promise<any> {
  // If the path is deeply nested, we need to recurse the down
  // the schema instances until we get to a field getter
  async function getGetter(schema: any, path: string): Promise<any> {
    let [key, ...tail] = path.split('.');
    await loadField(schema, key);
    let getter = schema[key];
    if (tail && tail.length) {
      return getGetter(getter, tail.join('.'));
    }
    return getter;
  }

  return await getGetter(schemaInstance, fieldName);
}

async function loadField(schemaInstance: any, fieldName: string): Promise<any> {
  let result;
  let isLoaded = false;
  do {
    try {
      result = schemaInstance[fieldName];
      isLoaded = true;
    } catch (e: any) {
      if (!isNotReadyError(e)) {
        throw e;
      }

      let { schemaInstance: instance, computeVia, cacheFieldName } = e;
      instance[cacheFieldName] = await instance[computeVia]();
    }
  } while (!isLoaded);
  return result;
}

export function fieldsAsList(fields: { [key: string]: Field }, path: string[] = []): [string, Field][] {
  let fieldList: [string, Field][] = [];
  for (let [fieldName, field] of Object.entries(fields)) {
    if (Object.keys(field.card.fields).length === 0) {
      fieldList.push([[...path, fieldName].join('.'), field]);
    } else {
      fieldList = [...fieldList, ...fieldsAsList(field.card.fields, [...path, fieldName])];
    }
  }
  return fieldList;
}

export function makeEmptyCardData(allFields: string[]): RawCardData {
  let data: RawCardData = {};
  for (let field of allFields) {
    set(data, field, null);
  }
  return data;
}

export function getProperties(object: Record<string, any>, properties: string[]) {
  return _getProperties(object, properties, get);
}

export function getSerializedProperties(object: Record<string, any>, properties: string[]) {
  return _getProperties(object, properties, serializedGet);
}

function _getProperties(object: Record<string, any>, properties: string[], getter: (obj: any, key: string) => any) {
  let data = {};
  for (let field of properties) {
    let value = getter(object, field);
    if (value !== undefined) {
      set(data, field, value);
    }
  }
  return data;
}

export function flattenData(data: Record<string, any>, path: string[] = []): [string, any][] {
  let result: [string, any][] = [];
  for (let [field, value] of Object.entries(data)) {
    if (isPlainObject(value)) {
      result = [...result, ...flattenData(value, [...path, field])];
    } else {
      result.push([[...path, field].join('.'), value]);
    }
  }
  return result;
}

export function keySensitiveGet(data: any, key: string) {
  let value = data[key];
  if (value === undefined) {
    throw new Error(`TODO: field ${key} is missing`);
  }
  return value;
}

export function serializerFor(schemaInstance: any, field: string) {
  return (schemaInstance.constructor as CardSchema).serializedMemberNames[field] ?? field;
}

// In this setter we are careful not to get the leaf, as it may throw a NotReady
// because it is missing (and we are about to set it). lodash set will
// inadvertently trigger our NotReady errors
export function keySensitiveSet(obj: Record<string, any>, path: string, value: any) {
  visitObjectLeaves(obj, path, (context, key) => (context[key] = value));
}

function serializedGet(obj: Record<string, any>, path: string) {
  return visitObjectLeaves(obj, path, (context, key) => serializerFor(context, key));
}

function visitObjectLeaves(
  obj: Record<string, any>,
  path: string,
  visitor: (context: Record<string, any>, key: string) => string | undefined
): any {
  let segments = path.split('.');
  let current: any = obj;
  let segment: string;
  let completed: string[] = [];
  while ((segment = segments.shift()!)) {
    if (segments.length === 0) {
      let result = visitor(current, segment);
      if (typeof result === 'string') {
        segment = result;
      }
    }
    current = current?.[segment];
    completed.push(segment);
  }
  return current;
}
