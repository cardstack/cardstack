/* eslint-disable @typescript-eslint/naming-convention */
import { parseISO, parse, format } from 'date-fns';
import merge from 'lodash/merge';
import { Card, Format, CardJSONResponse } from './interfaces';
import { serializeResource } from './utils/jsonapi';

export interface PrimitiveSerializer {
  serialize(val: any): any;
  deserialize(val: any): any;
}

const DateTimeSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
    return d.toISOString();
  },
  deserialize(d: string): Date {
    return parseISO(d);
  },
};

const DateSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
    // If the model hasn't been deserialized yet it will still be a string
    if (typeof d === 'string') {
      return d;
    }
    return format(d, 'yyyy-MM-dd');
  },
  deserialize(d: string): Date {
    return parse(d, 'yyyy-MM-dd', new Date());
  },
};

export default {
  datetime: DateTimeSerializer,
  date: DateSerializer,
};

export function serializeCardForFormat(card: Card, format: Format): CardJSONResponse {
  // TODO: typing....
  let componentInfo = card.compiled[format];
  let resource = serializeResource('card', card.compiled.url, componentInfo.usedFields, card.data) as any;
  resource.meta = merge(
    {
      componentModule: componentInfo.moduleName.global,
    },
    resource.meta
  );
  return { data: resource };
}
