import { CardId } from "./card";
import * as JSON from "json-typescript";
import { CARDSTACK_PUBLIC_REALM } from "./realm";

export interface Query {
  filter?: Filter;
  sort?: string | string[];
  page?: { size?: number; cursor?: string };
  queryString?: string;
}

export type Filter =
  | AnyFilter
  | EveryFilter
  | NotFilter
  | EqFilter
  | RangeFilter;

export interface TypedFilter {
  type?: CardId;
}

export interface AnyFilter extends TypedFilter {
  any: Filter[];
}

export interface EveryFilter extends TypedFilter {
  every: Filter[];
}

export interface NotFilter extends TypedFilter {
  not: Filter;
}

export interface EqFilter extends TypedFilter {
  eq: { [fieldName: string]: JSON.Value };
}

export interface RangeFilter extends TypedFilter {
  range: {
    [fieldName: string]: {
      gt?: JSON.Primitive;
      gte?: JSON.Primitive;
      lt?: JSON.Primitive;
      lte?: JSON.Primitive;
    };
  };
}

export function baseType(filter: Filter | undefined) {
  return filter?.type || { realm: CARDSTACK_PUBLIC_REALM, localId: 'base' };
}
