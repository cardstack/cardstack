/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface ComparisonHelperSignature {
  Args: { Positional: [any, any, { forceNumber?: boolean }?] };
  Return: boolean;
}

export class ComparisonHelper extends Helper<ComparisonHelperSignature> {}

interface EqualityHelperSignature {
  Args: { Positional: [any, any] };
  Return: boolean;
}

export class EqualityHelper extends Helper<EqualityHelperSignature> {}

declare const Unset: unique symbol;
export type UnsetValue = { [Unset]: true };

export type Falsy<T> = NonNullable<T> extends never ? true : false;
export type Maybe<T> = T & (null | undefined) extends never ? false : true;
