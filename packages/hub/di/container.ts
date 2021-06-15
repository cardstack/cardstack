export interface Container {
  instantiate<T, A extends unknown[]>(factory: Factory<T, A>, ...args: A): Promise<T>;
}

export interface FactoryByConstructor<T, A extends unknown[] = []> {
  new (...a: A): T;
}
export interface FactoryByCreateMethod<T, A extends unknown[] = []> {
  create(...a: A): T;
}

export type Factory<T, A extends unknown[] = []> = FactoryByConstructor<T, A> | FactoryByCreateMethod<T, A>;

export function isFactoryByCreateMethod<T, A extends unknown[] = []>(obj: any): obj is FactoryByCreateMethod<T, A> {
  return obj.create !== undefined;
}
