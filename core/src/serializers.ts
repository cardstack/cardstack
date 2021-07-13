import format from 'date-fns/format';
import parse from 'date-fns/parse';
export interface PrimitiveSerializer {
  serialize(val: any): any;
  deserialize(val: any): any;
}

let DateTimeSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
    return d.toISOString();
  },
  deserialize(d: string): Date {
    return new Date(d);
  },
};

let DateSerializer: PrimitiveSerializer = {
  serialize(d: Date): string {
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
