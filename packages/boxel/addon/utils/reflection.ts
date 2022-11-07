const isGetter = (obj: unknown, name: string): boolean =>
  !!(Object.getOwnPropertyDescriptor(obj, name) || {}).get;

const isFunction = (obj: Record<string, unknown>, name: string): boolean =>
  typeof obj[name] === 'function';

const deepFunctions = (obj: Record<string, unknown>): null | string[] => {
  if (!obj || obj === Object.prototype) return null;
  return Object.getOwnPropertyNames(obj)
    .filter((name) => isGetter(obj, name) || isFunction(obj, name))
    .concat(deepFunctions(Object.getPrototypeOf(obj)) || []);
};

const distinctDeepFunctions = (obj: Record<string, unknown>) =>
  Array.from(new Set(deepFunctions(obj)));

export const getMethodNames = (obj: Record<string, unknown>): string[] =>
  distinctDeepFunctions(obj).filter(
    (name: string) => name !== 'constructor' && !~name.indexOf('__')
  );
