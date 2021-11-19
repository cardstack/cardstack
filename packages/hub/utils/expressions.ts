import isPlainObject from 'lodash/isPlainObject';
import * as JSON from 'json-typescript';

export type Expression = (string | Param)[];

export type PgPrimitive = number | string | boolean | JSON.Object | JSON.Arr | null;

export interface Param {
  param: PgPrimitive;
  kind: 'param';
}

export function expressionToSql(query: Expression) {
  let values: PgPrimitive[] = [];
  let text = query
    .map((element) => {
      if (isParam(element)) {
        values.push(element.param);
        return `$${values.length}`;
      } else if (typeof element === 'string') {
        return element;
      } else {
        throw assertNever(element);
      }
    })
    .join(' ');
  console.log(text, values);
  return {
    text,
    values,
  };
}

export function addExplicitParens(expression: Expression): Expression {
  if (expression.length === 0) {
    return expression;
  } else {
    return ['(', ...expression, ')'];
  }
}

export function separatedByCommas(expressions: Expression[]): Expression {
  return expressions.reduce((accum, expression) => {
    if (accum.length > 0) {
      accum.push(',');
    }
    return accum.concat(expression);
  }, []);
}

export function param(value: PgPrimitive): Param {
  return { param: value, kind: 'param' };
}

export function isParam(expression: any): expression is Param {
  return isPlainObject(expression) && 'param' in expression;
}

export function every(expressions: Expression[]): Expression {
  if (expressions.length === 0) {
    return ['true']; // this is "SQL true", not javascript true
  }
  if (expressions.length === 1) {
    return expressions[0];
  }
  return expressions
    .map((expression) => addExplicitParens(expression))
    .reduce((accum, expression: Expression) => [...accum, 'AND', ...expression]);
}

export function any(expressions: Expression[]): Expression {
  if (expressions.length === 0) {
    return ['false']; // this is "SQL false", not javascript false
  }
  if (expressions.length === 1) {
    return expressions[0];
  }
  return expressions
    .map((expression) => addExplicitParens(expression))
    .reduce((accum, expression: Expression) => [...accum, 'OR', ...expression]);
}

export function safeName(name: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`potentially unsafe name in SQL: ${name}`);
  }
  return name;
}

export function columnName(name: string) {
  return `"${safeName(name)}"`;
}

// takes a pojo with column name keys and expression values
export function upsert(table: string, constraint: string, values: { [column: string]: Param }): Expression {
  let names = Object.keys(values).map(safeName);
  let nameExpressions = names.map((name) => [columnName(name)]);
  let valueExpressions = Object.keys(values).map((k) => {
    let v = values[k];
    if (!Array.isArray(v) && !isParam(v)) {
      throw new Error(`values passed to upsert helper must already be expressions. You passed ${v} for ${k}`);
    }
    if (isParam(v)) {
      return [v];
    }
    return v;
  });
  return [
    'insert into',
    safeName(table),
    ...addExplicitParens(separatedByCommas(nameExpressions)),
    'values',
    ...addExplicitParens(separatedByCommas(valueExpressions)),
    'on conflict on constraint',
    safeName(constraint),
    'do UPDATE SET',
    // this interpolation is safe because
    // of safeName() above. In general
    // don't add any more interpolations
    // unless you've really thought hard
    // about the security implications.
    ...separatedByCommas(names.map((name) => [`${columnName(name)}=EXCLUDED.${columnName(name)}`])),
  ];
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
