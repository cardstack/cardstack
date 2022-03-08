import isPlainObject from 'lodash/isPlainObject';
import * as JSON from 'json-typescript';
import Logger from '@cardstack/logger';

const log = Logger('utils:expression');

export type Expression = (string | Param)[];

export type PgPrimitive = number | string | boolean | JSON.Object | JSON.Arr | null;

export type CardExpression = (string | Param | Field)[];

export interface Param {
  param: PgPrimitive;
}

export interface Field {
  field: true;
  parentExpression: Expression;
  on: string; // cardURL
  path: string;
}

export function expressionToSql(query: Expression): { text: string; values: PgPrimitive[] } {
  let values: PgPrimitive[] = [];
  return _expressionToSql(query, values);
}

function _expressionToSql(query: Expression, values: PgPrimitive[]): { text: string; values: PgPrimitive[] } {
  let text = query
    .map((element): string => {
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
  log.debug('built expression %s %j', text, values);
  return {
    text,
    values,
  };
}

export function addExplicitParens<T extends Expression | CardExpression>(expression: T): T {
  if (expression.length === 0) {
    return expression;
  } else {
    return ['(', ...expression, ')'] as T;
  }
}

export function separatedByCommas<T extends Expression | CardExpression>(expressions: T[]): T {
  let result: T = [] as unknown as T;
  for (let [index, expression] of expressions.entries()) {
    if (index > 0) {
      result.push(',');
    }
    result = (result as any).concat(expression);
  }
  return result;
}

export function param(value: PgPrimitive): Param {
  return { param: value };
}

export function isParam(expression: any): expression is Param {
  return isPlainObject(expression) && 'param' in expression;
}

export function every<T extends Expression | CardExpression>(expressions: T[]): T {
  if (expressions.length === 0) {
    return ['true'] as T; // this is "SQL true", not javascript true
  }
  if (expressions.length === 1) {
    return expressions[0];
  }
  return expressions
    .map((expression) => addExplicitParens(expression))
    .reduce((accum, expression: T) => [...accum, 'AND', ...expression] as T);
}

export function any<T extends Expression | CardExpression>(expressions: T[]): T {
  if (expressions.length === 0) {
    return ['false'] as T; // this is "SQL false", not javascript false
  }
  if (expressions.length === 1) {
    return expressions[0];
  }
  return expressions
    .map((expression) => addExplicitParens(expression))
    .reduce((accum, expression: T) => [...accum, 'OR', ...expression] as T);
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

export function resolveNestedPath(
  parentExpression: Expression,
  segments: string[]
): { expression: Expression; leaf: string } {
  if (segments.length === 1) {
    return { expression: parentExpression, leaf: segments[segments.length - 1] };
  }
  return {
    expression: addExplicitParens([...parentExpression, '#>', param(segments.slice(0, -1))]),
    leaf: segments[segments.length - 1],
  };
}

export function field(parentExpression: Expression, on: string, path: string): Field {
  return {
    field: true,
    parentExpression,
    on,
    path,
  };
}

export function isField(expression: any): expression is Field {
  return isPlainObject(expression) && 'field' in expression;
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
