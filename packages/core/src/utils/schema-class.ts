interface Schema {
  [field: string]: Promise<any>;
}
interface SchemaClass extends Function {
  allFields: string[];
}

const valuesMap = new WeakMap<Schema, Promise<any>>();

export function getAllValues(schema: Schema): Promise<any> {
  let clazz = schema.constructor as SchemaClass;
  let values = valuesMap.get(schema);
  if (!values) {
    values = Promise.all(clazz.allFields.map((field) => schema[field]))!;
    valuesMap.set(schema, values);
  }
  return values;
}
