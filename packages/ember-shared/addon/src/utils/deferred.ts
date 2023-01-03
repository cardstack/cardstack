export class Deferred<T> {
  promise: Promise<T>;
  private resolve!: (result: T) => void;
  private reject!: (err: unknown) => void;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  fulfill(result: Promise<T> | T): void {
    Promise.resolve(result).then(this.resolve, this.reject);
  }
}
