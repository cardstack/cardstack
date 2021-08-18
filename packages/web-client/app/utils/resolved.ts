// http://ember-concurrency.com/docs/typescript
// infer whether we should treat the return of a yield statement as a promise
type Resolved<T> = T extends PromiseLike<infer R> ? R : T;

export default Resolved;
