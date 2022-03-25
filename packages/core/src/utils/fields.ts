import { isNotReadyError } from './errors';
import set from 'lodash/set';
import get from 'lodash/get';
import { TemplateUsageMeta } from '../babel-plugin-card-template';
import isPlainObject from 'lodash/isPlainObject';
import { FieldsWithPlaceholders, FieldWithPlaceholder } from '../compiler';
import { CardSchema, ComponentInfo, Format } from '../interfaces';

export function getFieldForPath(fields: FieldsWithPlaceholders, path: string): FieldWithPlaceholder | undefined {
  let paths = path.split('.');
  let [first, ...tail] = paths;

  let field = fields[first];

  if (paths.length > 1 && field.card !== 'self') {
    return getFieldForPath(field.card.fields, tail.join('.'));
  }

  return field;
}

export function buildUsedFieldsListFromUsageMeta(
  fields: FieldsWithPlaceholders,
  defaultFieldFormat: Format,
  usageMeta: TemplateUsageMeta
): ComponentInfo['usedFields'] {
  let usedFields: Set<string> = new Set();

  if (usageMeta.model && usageMeta.model !== 'self') {
    for (const fieldPath of usageMeta.model) {
      usedFields.add(fieldPath);
    }
  }

  if (usageMeta.fields === 'self') {
    usedFields = new Set([...usedFields, ...Object.keys(fields)]);
  } else {
    for (const [fieldPath, fieldFormat] of usageMeta.fields.entries()) {
      buildUsedFieldListFromComponents(
        usedFields,
        fieldPath,
        fields,
        fieldFormat === 'default' ? defaultFieldFormat : fieldFormat
      );
    }
  }

  return [...usedFields];
}
function buildUsedFieldListFromComponents(
  usedFields: Set<string>,
  fieldPath: string,
  fields: FieldsWithPlaceholders,
  format: Format,
  prefix?: string
): void {
  let field = getFieldForPath(fields, fieldPath);

  if (field && field.card !== 'self' && field.card.componentInfos[format].usedFields.length) {
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

export function getProperties(object: Record<string, any>, properties: string[]) {
  return getDataWithShape(object, properties, get);
}

export function getSerializedProperties(object: Record<string, any>, properties: string[]) {
  return getDataWithShape(object, properties, serializedGet);
}

function getDataWithShape(object: Record<string, any>, properties: string[], getter: (obj: any, key: string) => any) {
  let data = {};
  for (let field of properties) {
    let value = getter(object, field);
    if (value !== undefined) {
      set(data, field, value);
    }
  }
  return data;
}

export function getFieldsAtPath(path: string, fields: string[]): string[] {
  return fields.filter((field) => field.startsWith(path)).map((field) => field.substring(path.length + 1));
}

// In this setter we are careful not to get the leaf, as it may throw a NotReady
// because it is missing (and we are about to set it). lodash set will
// inadvertently trigger our NotReady errors
export function keySensitiveSet(obj: Record<string, any>, path: string, value: any) {
  visitObjectPath(obj, path, (pathParent, key) => (pathParent[key] = value));
}

function serializedGet(obj: Record<string, any>, path: string) {
  return visitObjectPath(obj, path, (pathParent, key) =>
    (pathParent.constructor as CardSchema).serializedGet(pathParent, key)
  );
}

function visitObjectPath(
  obj: Record<string, any>,
  path: string,
  visitor: (pathParent: Record<string, any>, key: string) => string | undefined
): any {
  let segments = path.split('.');
  let current: any = obj;
  let segment: string;
  let completed: string[] = [];
  while ((segment = segments.shift()!)) {
    if (segments.length === 0) {
      return visitor(current, segment);
    }
    current = current?.[segment];
    completed.push(segment);
  }
  return current;
}
