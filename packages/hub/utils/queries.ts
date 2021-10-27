import { ParsedUrlQuery } from 'querystring';
import { CardQuery } from '@cardstack/core/src/interfaces';
import { BadRequest } from './error';

// Takes an object with keys and values for querying and transforms them into parts
// suitable for passing into `db.query()` (DatabaseManager).
//
// Example: `buildConditions({ name: "Phil", age: 45 })`
// => { where: 'name=$1 AND age=$2', values: [ 'Phil', 45 ] }

export function buildConditions(params: any) {
  let conditions = Object.keys(params).map((key, index) => {
    return `${key}=$${index + 1}`;
  });

  let values = Object.values(params);

  return {
    where: conditions.join(' AND '),
    values: values,
  };
}

export function queryParamsToCardQuery(queryParams: ParsedUrlQuery): CardQuery {
  let cardQuery = {};
  for (const key in queryParams) {
    switch (key) {
      case 'adoptsFrom':
        cardQuery = { filter: { in: { adoptsFrom: queryParams[key] } } };
        break;

      default:
        throw new BadRequest('Invalid query params');
    }
  }
  return cardQuery;
}

export function cardQueryToSQL(query: CardQuery): string {
  let sql = ['SELECT * FROM card_index'];

  let where = [];
  let { in: inFilter } = query.filter;
  for (const key in inFilter) {
    where.push(`'${inFilter[key]}' = ANY ${key}`);
  }
  if (where.length) {
    sql.push(`WHERE ${where.join(' AND ')}`);
  }

  return sql.join(' ');
}
