import { Argv } from 'yargs';

export let command = 'transform-prisma-schema';
export let describe = 'Transform schema.prisma to camelCase model and property names';
export let builder = {};

// Adapted from here: https://github.com/prisma/prisma/discussions/2530#discussioncomment-17535

import * as fs from 'fs';
import * as path from 'path';
import { camelCase, upperFirst } from 'lodash';
import * as pluralize from 'pluralize';

export async function handler(_argv: Argv) {
  try {
    await fixPrismaFile();
  } catch (e) {
    console.error(e);
  }
}

const PRISMA_FILE_PATH = path.join(__dirname, '../../prisma/schema.prisma');

function snakeToCamel(str: string) {
  return camelCase(str);
}
function snakeToPascal(str: string) {
  return upperFirst(camelCase(str));
}

const PRISMA_PRIMITIVES = ['String', 'Boolean', 'Int', 'Float', 'DateTime'];
const INTERNAL_MODELS = ['pgmigrations'];

function isInternalModel(typeName: string) {
  return INTERNAL_MODELS.includes(typeName);
}

function isPrimitiveType(typeName: string) {
  return PRISMA_PRIMITIVES.includes(typeName);
}

function isEnumType(typeName: string) {
  return typeName.endsWith('_enum');
}

function fixFieldsArrayString(fields: string) {
  return fields
    .split(', ')
    .map((field) => snakeToCamel(field))
    .join(', ');
}

async function fixPrismaFile() {
  const text = await fs.promises.readFile(PRISMA_FILE_PATH, 'utf8');

  const textAsArray = text.split('\n');

  const fixedText = [];
  let currentModelName: string | null = null;
  let hasAddedModelMap = false;

  for (let line of textAsArray) {
    // Are we at the start of a model definition
    const modelMatch = line.match(/^model (\w+) {$/);
    if (modelMatch) {
      currentModelName = modelMatch[1];
      if (isInternalModel(currentModelName)) {
        continue;
      }
      hasAddedModelMap = false;
      const singularPascalModelName = pluralize.singular(snakeToPascal(currentModelName));
      fixedText.push(`model ${singularPascalModelName} {`);
      continue;
    }

    if (currentModelName && isInternalModel(currentModelName)) {
      continue;
    }

    // We don't need to change anything if we aren't in a model body
    if (!currentModelName) {
      fixedText.push(line);
      continue;
    }

    // Add the @@map to the table name for the model
    if (!hasAddedModelMap && (line.match(/\s+@@/) || line === '}')) {
      if (line === '}') {
        fixedText.push('');
      }
      fixedText.push(`  @@map("${currentModelName}")`);
      hasAddedModelMap = true;
    }

    // Renames field and applies a @map to the field name if it is snake case
    // Adds an s to the field name if the type is an array relation
    const fieldMatch = line.match(/\s\s(\w+)\s+(\w+)(\[\])?/);
    let fixedLine = line;
    if (fieldMatch) {
      const [, currentFieldName, currentFieldType, isArrayType] = fieldMatch;

      let fixedFieldName = snakeToCamel(currentFieldName);
      if (isArrayType && !pluralize.isPlural(fixedFieldName)) {
        fixedFieldName = pluralize.plural(fixedFieldName);
      }

      fixedLine = fixedLine.replace(currentFieldName, fixedFieldName);

      // Add map if we needed to convert the field name and the field is not a relational type
      // If it's relational, the field type will be a non-primitive, hence the isPrimitiveType check
      // If it’s an enum, leave it alone because it will stay snake_case
      if (currentFieldName.includes('_') && (isPrimitiveType(currentFieldType) || isEnumType(currentFieldType))) {
        fixedLine = `${fixedLine} @map("${currentFieldName}")`;
      }
    }

    // Capitalizes model names in field types
    const fieldTypeMatch = fixedLine.match(/\s\s\w+\s+(\w+)/);
    if (fieldTypeMatch) {
      const currentFieldType = fieldTypeMatch[1];

      // If it’s an enum, leave it alone because it will stay snake_case
      if (!isEnumType(currentFieldType)) {
        const fieldTypeIndex = fieldTypeMatch[0].lastIndexOf(currentFieldType);
        const fixedFieldType = pluralize.singular(snakeToPascal(currentFieldType));
        const startOfLine = fixedLine.substr(0, fieldTypeIndex);
        const restOfLine = fixedLine.substr(fieldTypeIndex + currentFieldType.length);
        fixedLine = `${startOfLine}${fixedFieldType}${restOfLine}`;
      }
    }

    // Changes `fields: [relation_id]` in @relation to camel case
    const relationFieldsMatch = fixedLine.match(/fields:\s\[([\w,\s]+)\]/);
    if (relationFieldsMatch) {
      const fields = relationFieldsMatch[1];
      fixedLine = fixedLine.replace(fields, fixFieldsArrayString(fields));
    }

    // Changes fields listed in @@index or @@unique to camel case
    const indexUniqueFieldsMatch = fixedLine.match(/@@\w+\(\[([\w,\s]+)\]/);
    if (indexUniqueFieldsMatch) {
      const fields = indexUniqueFieldsMatch[1];
      fixedLine = fixedLine.replace(fields, fixFieldsArrayString(fields));
    }

    fixedText.push(fixedLine);
  }

  await fs.promises.writeFile(PRISMA_FILE_PATH, fixedText.join('\n'));
}

fixPrismaFile();
