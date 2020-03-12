import * as JSON from 'json-typescript';

export type Expression = (string | Param)[];

export type PgPrimitive = number | string | boolean | JSON.Object | JSON.Arr | null;

export interface Param {
  param: PgPrimitive;
  kind: 'param';
}
