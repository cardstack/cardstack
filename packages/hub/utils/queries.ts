import { pickBy } from 'lodash';

export const NOT_NULL = '!NOT NULL!';

const camelToSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// Takes an object with keys and values for querying and transforms them into parts
// suitable for passing into `db.query()` (DatabaseManager).
//
// Example: `buildConditions({ name: "Phil", age: 45 })`
// => { where: 'name=$1 AND age=$2', values: [ 'Phil', 45 ] }

export function buildConditions(params: any, tableName?: string) {
  // Only allow nulls, strings and numbers in the params
  let filteredParams = Object.fromEntries(
    Object.entries(params).filter(
      ([_key, value]) => value == null || typeof value === 'number' || typeof value === 'string'
    )
  );

  let presentParams = pickBy(filteredParams, function (value) {
    return value !== null && value !== NOT_NULL;
  });
  let notNullParams = pickBy(filteredParams, function (value) {
    return value === NOT_NULL;
  });
  let nullParams = pickBy(filteredParams, function (value) {
    return value === null;
  });

  let presentConditions = Object.keys(presentParams).map((key, index) => {
    return `${tableName ? `${tableName}.` : ''}${camelToSnakeCase(key)}=$${index + 1}`;
  });

  let notNullConditions = Object.keys(notNullParams).map((key) => {
    return `${tableName ? `${tableName}.` : ''}${camelToSnakeCase(key)} IS NOT NULL`;
  });

  let nullConditions = Object.keys(nullParams).map((key) => {
    return `${tableName ? `${tableName}.` : ''}${camelToSnakeCase(key)} IS NULL`;
  });

  return {
    where: presentConditions.concat(notNullConditions, nullConditions).flat().join(' AND '),
    values: Object.values(presentParams),
  };
}
