const camelToSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// Takes an object with keys and values for querying and transforms them into parts
// suitable for passing into `db.query()` (DatabaseManager).
//
// Example: `buildConditions({ name: "Phil", age: 45 })`
// => { where: 'name=$1 AND age=$2', values: [ 'Phil', 45 ] }

export function buildConditions(params: any) {
  let conditions = Object.keys(params).map((key, index) => {
    return `${camelToSnakeCase(key)}=$${index + 1}`;
  });

  let values = Object.values(params);

  return {
    where: conditions.join(' AND '),
    values: values,
  };
}
