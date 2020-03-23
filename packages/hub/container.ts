export interface Container {
  instantiate<T, A extends unknown[]>(factory: Factory<T, A>, ...args: A): Promise<T>;
}

export interface Factory<T, A extends unknown[] = []> {
  new (...a: A): T;
}
