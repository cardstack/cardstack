export interface Serializer {
  serialize(val: any): any;
  deserialize(val: any): any;
}

let DateSerializer: Serializer = {
  serialize(d: Date): string {
    return d.toISOString();
  },
  deserialize(d: string): Date {
    return new Date(d);
  },
};

export default {
  date: DateSerializer,
};
