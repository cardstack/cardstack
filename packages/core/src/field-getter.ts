type RawFieldGetter = (fieldPath: string) => any;

export default class FieldGetter {
  constructor(private get: RawFieldGetter, private fieldName: string) {}

  // TODO add promise support (.then, .catch, etc)
}
