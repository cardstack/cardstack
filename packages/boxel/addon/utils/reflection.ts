type POJO = Record<string, unknown>;

const isGetter = (obj: POJO, name: string): boolean =>
  !!(Object.getOwnPropertyDescriptor(obj, name) || {}).get;

const isFunction = (obj: POJO, name: string): boolean =>
  typeof obj[name] === 'function';

const deepFunctions = (obj: POJO): null | string[] => {
  if (!obj || obj === Object.prototype) return null;
  return Object.getOwnPropertyNames(obj)
    .filter((name) => isGetter(obj, name) || isFunction(obj, name))
    .concat(deepFunctions(Object.getPrototypeOf(obj)) || []);
};

const distinctDeepFunctions = (obj: POJO) =>
  Array.from(new Set(deepFunctions(obj)));

export const getMethodNames = <Obj extends Record<keyof Obj, unknown>>(
  obj: Obj
): string[] =>
  distinctDeepFunctions(obj).filter(
    (name: string) => name !== 'constructor' && !~name.indexOf('__')
  );
