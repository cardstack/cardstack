import { CardId } from './card-id';
import * as JSON from 'json-typescript';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { CardstackError } from './error';
import isEqual from 'lodash/isEqual';
import { assertJSONValue, assertJSONPrimitive } from './json-validation';

export interface Query {
  filter?: Filter;
  sort?: string | string[];
  page?: { size?: number | string; cursor?: string };
  queryString?: string;
}

export type Filter = AnyFilter | EveryFilter | NotFilter | EqFilter | RangeFilter | CardTypeFilter;
export type InteriorFilter = Exclude<Filter, CardTypeFilter>;

export interface TypedFilter {
  type?: CardId;
}

// The CardTypeFilter is used when you solely want to filter for all cards that
// adopt from some particular card type--no other predicates are included in
// this filter.
export interface CardTypeFilter {
  type: CardId;
}

export interface AnyFilter extends TypedFilter {
  any: InteriorFilter[];
}

export interface EveryFilter extends TypedFilter {
  every: InteriorFilter[];
}

export interface NotFilter extends TypedFilter {
  not: InteriorFilter;
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
  return filter?.type || { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' };
}

export function assertQuery(query: any, pointer: string[] = ['']): asserts query is Query {
  if (typeof query !== 'object' || query == null) {
    throw new CardstackError('missing query object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  if ('filter' in query) {
    assertFilter(query.filter, pointer.concat('filter'));
  }

  if (
    'sort' in query &&
    typeof query.sort !== 'string' &&
    (!Array.isArray(query.sort) || query.sort.some((i: any) => typeof i !== 'string'))
  ) {
    throw new CardstackError('sort must be a string or string array', {
      source: { pointer: pointer.concat('sort').join('/') },
      status: 400,
    });
  }

  if ('queryString' in query && typeof query.queryString !== 'string') {
    throw new CardstackError('queryString must be a string', {
      source: { pointer: pointer.concat('queryString').join('/') },
      status: 400,
    });
  }

  if ('page' in query) {
    assertPage(query.page, pointer.concat('page'));
  }
}

export function assertPage(page: any, pointer: string[]): asserts page is Query['page'] {
  if (typeof page !== 'object' || page == null) {
    throw new CardstackError('missing page object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  if ('size' in page) {
    if (
      (typeof page.size !== 'number' && typeof page.size !== 'string') ||
      (typeof page.size === 'string' && isNaN(page.size))
    ) {
      throw new CardstackError('size must be a number', {
        source: { pointer: pointer.concat('size').join('/') },
        status: 400,
      });
    }
  }

  if ('cursor' in page && typeof page.cursor !== 'string') {
    throw new CardstackError('cursor must be a string', {
      source: { pointer: pointer.concat('cursor').join('/') },
      status: 400,
    });
  }
}

export function assertFilter(filter: any, pointer: string[]): asserts filter is Filter {
  if (typeof filter !== 'object' || filter == null) {
    throw new CardstackError('missing filter object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  if ('type' in filter) {
    assertCardId(filter.type, pointer.concat('type'));
    if (isEqual(Object.keys(filter), ['type'])) {
      return; // This is a pure card type filter
    }
  }

  if ('any' in filter) {
    assertAnyFilter(filter, pointer);
  } else if ('every' in filter) {
    assertEveryFilter(filter, pointer);
  } else if ('not' in filter) {
    assertNotFilter(filter, pointer);
  } else if ('eq' in filter) {
    assertEqFilter(filter, pointer);
  } else if ('range' in filter) {
    assertRangeFilter(filter, pointer);
  } else {
    throw new CardstackError('cannot determine the type of filter', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
}

export function assertCardId(id: any, pointer: string[]): asserts id is CardId {
  if (typeof id !== 'object' || id == null) {
    throw new CardstackError('card id must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  if (!('csId' in id) || typeof id.csId !== 'string') {
    throw new CardstackError('csId must be a string', {
      source: { pointer: pointer.concat('csId').join('/') || '/' },
      status: 400,
    });
  }

  if (!('csRealm' in id) || typeof id.csRealm !== 'string') {
    throw new CardstackError('csRealm must be a string', {
      source: { pointer: pointer.concat('csRealm').join('/') || '/' },
      status: 400,
    });
  }

  if ('csOriginalRealm' in id && typeof id.csOriginalRealm !== 'string') {
    throw new CardstackError('csOriginalRealm must be a string', {
      source: { pointer: pointer.concat('csOriginalRealm').join('/') || '/' },
      status: 400,
    });
  }
}

export function assertAnyFilter(filter: any, pointer: string[]): asserts filter is AnyFilter {
  if (typeof filter !== 'object' || filter == null) {
    throw new CardstackError('filter must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  pointer.concat('any');
  if (!('any' in filter)) {
    throw new CardstackError('AnyFilter must have any property', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  if (!Array.isArray(filter.any)) {
    throw new CardstackError('any must be an array of Filters', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  } else {
    filter.any.every((value: any, index: number) => assertFilter(value, pointer.concat(`[${index}]`)));
  }
}

export function assertEveryFilter(filter: any, pointer: string[]): asserts filter is EveryFilter {
  if (typeof filter !== 'object' || filter == null) {
    throw new CardstackError('filter must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  pointer.concat('every');
  if (!('every' in filter)) {
    throw new CardstackError('EveryFilter must have every property', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  if (!Array.isArray(filter.every)) {
    throw new CardstackError('every must be an array of Filters', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  } else {
    filter.every.every((value: any, index: number) => assertFilter(value, pointer.concat(`[${index}]`)));
  }
}

export function assertNotFilter(filter: any, pointer: string[]): asserts filter is NotFilter {
  if (typeof filter !== 'object' || filter == null) {
    throw new CardstackError('filter must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  pointer.concat('not');
  if (!('not' in filter)) {
    throw new CardstackError('NotFilter must have not property', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }

  assertFilter(filter.not, pointer);
}

export function assertEqFilter(filter: any, pointer: string[]): asserts filter is EqFilter {
  if (typeof filter !== 'object' || filter == null) {
    throw new CardstackError('filter must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  pointer.concat('eq');
  if (!('eq' in filter)) {
    throw new CardstackError('EqFilter must have eq property', {
      source: { pointer: pointer.concat('eq').join('/') || '/' },
      status: 400,
    });
  }
  if (typeof filter.eq !== 'object' || filter.eq == null) {
    throw new CardstackError('eq must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  Object.entries(filter.eq).every(([key, value]) => assertJSONValue(value, pointer.concat(key)));
}

export function assertRangeFilter(filter: any, pointer: string[]): asserts filter is RangeFilter {
  if (typeof filter !== 'object' || filter == null) {
    throw new CardstackError('filter must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  pointer.concat('range');
  if (!('range' in filter)) {
    throw new CardstackError('RangeFilter must have range property', {
      source: { pointer: pointer.concat('range').join('/') || '/' },
      status: 400,
    });
  }
  if (typeof filter.range !== 'object' || filter.range == null) {
    throw new CardstackError('range must be an object', {
      source: { pointer: pointer.join('/') || '/' },
      status: 400,
    });
  }
  Object.entries(filter.range).every(([key, value]) => {
    switch (key) {
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        assertJSONPrimitive(value, pointer.concat(key));
        return;

      default:
        throw new CardstackError('range item must be gt, gte, lt, or lte', {
          source: { pointer: pointer.join('/') },
          status: 400,
        });
    }
  });
}
