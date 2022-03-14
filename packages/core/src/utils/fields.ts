import { TemplateUsageMeta } from '../glimmer-plugin-card-template';
import { CompiledCard, ComponentInfo, Field, Format, RawCardData } from '../interfaces';
import { isNotReadyError } from './errors';
import set from 'lodash/set';
import get from 'lodash/get';

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

export function fieldsAsList(fields: { [key: string]: Field }, path: string[] = []): string[] {
  let fieldList: string[] = [];
  for (let [fieldName, field] of Object.entries(fields)) {
    if (Object.keys(field.card.fields).length === 0) {
      fieldList.push([...path, fieldName].join('.'));
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
  let data = {};
  for (let field of properties) {
    let value = get(object, field);
    if (value !== undefined) {
      set(data, field, value);
    }
  }
  return data;
}
