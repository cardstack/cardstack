export default {
  date: {
    serialize(d: Date): string {
      return d.toISOString();
    },
    deserialize(d: string): Date {
      return new Date(d);
    },
  },
};
