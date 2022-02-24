import { TemplateUsageMeta } from '../glimmer-plugin-card-template';
import { assertValidSerializerMap, CompiledCard, ComponentInfo, Field, Format, SerializerMap } from '../interfaces';
import { isNotReadyError } from './errors';

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

export function buildSerializerMapFromUsedFields(fields: CompiledCard['fields'], usedFields: string[]): SerializerMap {
  let map: any = {};

  for (const fieldPath of usedFields) {
    let field = getFieldForPath(fields, fieldPath);

    if (!field) {
      continue;
    }

    buildDeserializerMapForField(map, field, fieldPath);
  }

  assertValidSerializerMap(map);

  return map;
}

function buildDeserializerMapForField(map: any, field: Field, usedPath: string): void {
  if (Object.keys(field.card.fields).length) {
    let { fields } = field.card;
    for (const name in fields) {
      buildDeserializerMapForField(map, fields[name], `${usedPath}.${name}`);
    }
  } else {
    if (!field.card.serializer) {
      return;
    }

    if (!map[field.card.serializer]) {
      map[field.card.serializer] = [];
    }

    map[field.card.serializer].push(usedPath);
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
