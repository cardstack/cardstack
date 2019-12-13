import { inject } from '../dependency-injection';
import { param, PgPrimitive, Expression, separatedByCommas, addExplicitParens } from '../pgsearch/util';
import { Memoize } from 'typescript-memoize';

interface JobNotifier {
  resolve: Function | undefined;
  reject: Function | undefined;
}

export default class Queue {
  private pgclient = inject('pgclient');
  private handlers: Map<string, Function> = new Map();
  notifiers: Map<string, JobNotifier> = new Map();

  async publish<T>(queue: string, category: string, args: PgPrimitive): Promise<Job<T>> {
    let ensureQueue: Expression = [`insert into queues (name) values (`, param(queue), `) on conflict do nothing`];
    await this.pgclient.query(ensureQueue);

    let jobRow: { [name: string]: PgPrimitive } = { args, queue, category };
    let nameExpressions = Object.keys(jobRow).map(name => [name]);
    let valueExpressions = Object.keys(jobRow).map(name => [param(jobRow[name])]);
    let newJob: Expression = [
      'insert into jobs',
      ...addExplicitParens(separatedByCommas(nameExpressions)),
      'values',
      ...addExplicitParens(separatedByCommas(valueExpressions)),
      'returning id',
    ];
    let {
      rows: [{ id: jobId }],
    } = await this.pgclient.query(newJob);

    return new Job(jobId, this);
  }

  // Services can register async function handlers that are invoked when a job is kicked off
  subscribe<A, T>(category: string, handler: (arg: A) => Promise<T>) {
    this.handlers.set(category, handler);
  }

  unsubscribe(category: string) {
    this.handlers.delete(category);
  }
}

export class Job<T> {
  constructor(private jobId: string, private queue: Queue) {}

  @Memoize()
  private buildPromise() {
    let resolve, reject;
    let promise = new Promise((r, e) => {
      resolve = r;
      reject = e;
    });
    this.queue.notifiers.set(this.jobId, { resolve, reject });

    return {
      resolve,
      reject,
      promise: promise as Promise<T>,
    };
  }

  get done(): Promise<T> {
    return this.buildPromise().promise;
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    queue: Queue;
  }
}
