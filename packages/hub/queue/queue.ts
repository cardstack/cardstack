import { inject } from '../dependency-injection';
import { param, PgPrimitive, Expression } from '../pgsearch/util';
import { Memoize } from 'typescript-memoize';

export default class Queue {
  private pgclient = inject('pgclient');
  private handlers: Map<string, Function> = new Map();
  private jobs: Map<string, Promise<void>> = new Map();

  async publish<T>(name: string, arg: PgPrimitive): Promise<Job<T>> {
    let queueName = `${name}_${JSON.stringify(arg)}`;

    let ensureQueue: Expression = [`insert into queues (name) values (`, param(queueName), `) on conflict do nothing`];
    await this.pgclient.query(ensureQueue);

    let newJob: Expression = [
      'insert into jobs (name, args, queue) values (',
      param(name),
      ',',
      param(arg),
      ') returning id',
    ];
    let {
      rows: [{ id: jobId }],
    } = await this.pgclient.query(newJob);

    return new Job(jobId, this);
  }

  // Services can register async function handlers that are invoked when a job is kicked off
  // for the job "name"
  subscribe<A, T>(name: string, handler: (arg: A) => Promise<T>) {
    this.handlers.set(name, handler);
  }

  unsubscribe(name: string) {
    this.handlers.delete(name);
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
