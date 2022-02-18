import { pickBy } from 'lodash';
import { Client } from 'pg';
import crypto from 'crypto';

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

  let nonNullParams = pickBy(filteredParams, function (value) {
    return value !== null;
  });
  let nullParams = pickBy(filteredParams, function (value) {
    return value === null;
  });

  let nonNullconditions = Object.keys(nonNullParams).map((key, index) => {
    return `${tableName ? `${tableName}.` : ''}${camelToSnakeCase(key)}=$${index + 1}`;
  });

  let nullConditions = Object.keys(nullParams).map((key) => {
    return `${tableName ? `${tableName}.` : ''}${camelToSnakeCase(key)} IS NULL`;
  });

  return {
    where: nonNullconditions.concat(nullConditions).flat().join(' AND '),
    values: Object.values(nonNullParams),
  };
}

export async function inTransaction(db: Client, cb: any) {
  let transactionId = crypto.randomBytes(20).toString('hex');

  try {
    await db.query(`SAVEPOINT ${transactionId}`);
    await cb();
    await db.query(`RELEASE SAVEPOINT ${transactionId}`);
  } catch (e) {
    await db.query(`ROLLBACK TO SAVEPOINT ${transactionId}`);
    throw e;
  }
}
