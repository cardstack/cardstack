import { inject } from '../dependency-injection';
import { param, PgPrimitive, Expression, separatedByCommas, addExplicitParens, any } from '../pgsearch/util';
import { Memoize } from 'typescript-memoize';
import isEqual from 'lodash/isEqual';

interface JobNotifier {
  resolve: Function | undefined;
  reject: Function | undefined;
}

export interface QueueOpts {
  queueName?: string;
}

const defaultQueueOpts: Required<QueueOpts> = Object.freeze({
  queueName: 'default',
});

export default class Queue {
  pollInterval = 10000;

  private pgclient = inject('pgclient');
  private handlers: Map<string, Function> = new Map();
  notifiers: Map<string, JobNotifier> = new Map();

  private shuttingDown = false;
  private jobRunnerPromise: Promise<void> | undefined;
  private resolveJobRunner: (() => void) | undefined;
  private runnerTimeout: NodeJS.Timeout | undefined;

  async publish<T>(category: string, args: PgPrimitive, opts: QueueOpts = {}): Promise<Job<T>> {
    let optsWithDefaults = Object.assign({}, defaultQueueOpts, opts);
    let jobRow: { [name: string]: PgPrimitive } = { args, queue: optsWithDefaults.queueName, category };
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
    await this.pgclient.query([`NOTIFY jobs`]);
    return new Job(jobId, this);
  }

  // Services can register async function handlers that are invoked when a job is kicked off
  register<A, T>(category: string, handler: (arg: A) => Promise<T>) {
    this.handlers.set(category, handler);
  }

  launchJobRunner() {
    if (!this.jobRunnerPromise) {
      this.jobRunnerPromise = this.jobRunner();
    }
  }

  private async runJob(category: string, args: PgPrimitive) {
    let handler = this.handlers.get(category);
    if (!handler) {
      throw new Error(`unknown job handler ${category}`);
    }
    return await handler(args);
  }

  private async jobRunner() {
    await this.pgclient.withConnection(async ({ client, query: listenQuery }) => {
      client.on('notification', this.wakeJobRunner.bind(this));
      await listenQuery(['LISTEN jobs']);
      while (!this.shuttingDown) {
        await this.pgclient.withConnection(async ({ query }) => {
          await query(['BEGIN']);
          let jobs = await query([
            // find the queue with the oldest job that isn't running, and return
            // all jobs on that queue, locking them. SKIP LOCKED means we won't
            // see any jobs that are already running.
            `select * from jobs where queue=(select queue from jobs where status='unfulfilled' order by created_at limit 1) for update skip locked`,
          ]);
          if (jobs.rowCount > 0) {
            let firstJob = jobs.rows[0];
            let coalescedIds: number[] = jobs.rows
              .filter(r => r.category === firstJob.category && isEqual(r.args, firstJob.args))
              .map(r => r.id);
            let newStatus: string;
            let result: PgPrimitive;
            try {
              result = await this.runJob(firstJob.category, firstJob.args);
              newStatus = 'resolved';
            } catch (err) {
              result = err;
              newStatus = 'rejected';
            }
            await query([
              `update jobs set result=`,
              param(result),
              ', status=',
              param(newStatus),
              `, finished_at=now() where `,
              ...any(coalescedIds.map(id => [`id=`, param(id)])),
            ]);
          }
          await query(['COMMIT']);
        });
        await this.jobRunnerSleep();
      }
    });
  }

  private async jobRunnerSleep() {
    let sleepPromise = new Promise(resolve => {
      this.resolveJobRunner = resolve;
    });
    let timerPromise = new Promise(resolve => {
      this.runnerTimeout = setTimeout(resolve, this.pollInterval);
    });
    await Promise.race([sleepPromise, timerPromise]);
    if (this.runnerTimeout != null) {
      clearTimeout(this.runnerTimeout);
    }
    this.resolveJobRunner = undefined;
  }

  private wakeJobRunner() {
    if (this.resolveJobRunner != null) {
      this.resolveJobRunner();
    }
  }

  async teardown() {
    this.shuttingDown = true;
    this.wakeJobRunner();
    await this.jobRunnerPromise;
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
