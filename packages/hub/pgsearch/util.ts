import * as JSON from "json-typescript";
import { CardId } from "../card";
export type PgPrimitive =
  | number
  | string
  | boolean
  | JSON.Object
  | JSON.Arr
  | null;

export interface Param {
  param: PgPrimitive;
  kind: "param";
}

export interface FieldQuery {
  typeContext: CardId;
  path: string;
  errorHint: string;
  kind: "field-query";
}

export interface FieldValue {
  typeContext: CardId;
  path: string;
  value: Expression;
  errorHint: string;
  kind: "field-value";
}

export interface FieldArity {
  typeContext: CardId;
  path: string;
  singular: Expression;
  plural: Expression;
  errorHint: string;
  kind: "field-arity";
}

export type Expression = (
  | string
  | Param
  | FieldQuery
  | FieldValue
  | FieldArity
)[];

export type SyncExpression = (string | Param)[];

export function addExplicitParens(expression: Expression): Expression {
  if (expression.length === 0) {
    return expression;
  } else {
    return ["(", ...expression, ")"];
  }
}

export function separatedByCommas(expressions: Expression[]): Expression {
  return expressions.reduce((accum, expression) => {
    if (accum.length > 0) {
      accum.push(",");
    }
    return accum.concat(expression);
  }, []);
}

export function param(value: PgPrimitive): Param {
  return { param: value, kind: "param" };
}

export function isParam(expression: any): expression is Param {
  return expression?.hasOwnProperty("param");
}

export function every(expressions: Expression[]): Expression {
  if (expressions.length === 0) {
    return ["true"]; // this is "SQL true", not javascript true
  }
  return expressions
    .map(addExplicitParens)
    .reduce((accum, expression) => [...accum, "AND", ...expression]);
}

export function fieldQuery(
  typeContext: CardId,
  path: string,
  errorHint: string
): FieldQuery {
  return {
    typeContext,
    path,
    errorHint,
    kind: "field-query"
  };
}

export function fieldValue(
  typeContext: CardId,
  path: string,
  value: Expression,
  errorHint: string
): FieldValue {
  return {
    typeContext,
    path,
    value,
    errorHint,
    kind: "field-value"
  };
}

export function fieldArity(
  typeContext: CardId,
  path: string,
  singular: Expression,
  plural: Expression,
  errorHint: string
): FieldArity {
  return {
    typeContext,
    path,
    singular,
    plural,
    errorHint,
    kind: "field-arity"
  };
}

export function any(expressions: Expression[]): Expression {
  if (expressions.length === 0) {
    return ["false"]; // this is "SQL false", not javascript false
  }
  return expressions
    .map(addExplicitParens)
    .reduce((accum, expression) => [...accum, "OR", ...expression]);
}

export function safeName(name: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`potentially unsafe name in SQL: ${name}`);
  }
  return name;
}

// takes a pojo with column name keys and expression values
export function upsert(
  table: string,
  constraint: string,
  values: { [column: string]: Expression | Param }
) {
  let names = Object.keys(values).map(safeName);
  let nameExpressions = names.map(name => [name]);
  let valueExpressions = Object.keys(values).map(k => {
    let v = values[k];
    if (!Array.isArray(v) && !isParam(v)) {
      throw new Error(
        `values passed to upsert helper must already be expressions. You passed ${v} for ${k}`
      );
    }
    if (isParam(v)) {
      return [v];
    }
    return v;
  });
  return [
    "insert into",
    safeName(table),
    ...addExplicitParens(separatedByCommas(nameExpressions)),
    "values",
    ...addExplicitParens(separatedByCommas(valueExpressions)),
    "on conflict on constraint",
    safeName(constraint),
    "do UPDATE SET",
    // this interpolation is safe because
    // of safeName() above. In general
    // don't add any more interpolations
    // unless you've really thought hard
    // about the security implications.
    ...separatedByCommas(names.map(name => [`${name}=EXCLUDED.${name}`]))
  ];
}
