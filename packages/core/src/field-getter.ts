type RawFieldGetter = (fieldPath: string) => any;

export default class FieldGetter {
  constructor(private get: RawFieldGetter, private fieldName: string) {}

  then(resolveFn: (value: string) => any) {
    resolveFn(this.get(this.fieldName));
  }

  catch() {
    console.log('FieldGetter: CATCH!');
  }

  finally() {
    console.log('FieldGetter: FINALLY!');
  }
}
