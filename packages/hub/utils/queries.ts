import { pickBy } from 'lodash';

const camelToSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// Takes an object with keys and values for querying and transforms them into parts
// suitable for passing into `db.query()` (DatabaseManager).
//
// Example: `buildConditions({ name: "Phil", age: 45 })`
// => { where: 'name=$1 AND age=$2', values: [ 'Phil', 45 ] }

export function buildConditions(params: any) {
  let nonNullParams = pickBy(params, function (value) {
    return value !== null;
  });
  let nullParams = pickBy(params, function (value) {
    return value === null;
  });

  let nonNullconditions = Object.keys(nonNullParams).map((key, index) => {
    return `${camelToSnakeCase(key)}=$${index + 1}`;
  });

  let nullConditions = Object.keys(nullParams).map((key) => {
    return `${camelToSnakeCase(key)} IS NULL`;
  });

  return {
    where: nonNullconditions.concat(nullConditions).flat().join(' AND '),
    values: Object.values(nonNullParams),
  };
}
