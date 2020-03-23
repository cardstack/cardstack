import { inject } from '../dependency-injection';
import { param, separatedByCommas, addExplicitParens, any } from '../pgsearch/util';
import { PgPrimitive, Expression } from '../expression';
import { Memoize } from 'typescript-memoize';
import isEqual from 'lodash/isEqual';
import logger from '@cardstack/logger';

const log = logger('cardstack/queue');

interface JobNotifier {
  resolve: Function;
  reject: Function;
}

export interface QueueOpts {
  queueName?: string;
}

const defaultQueueOpts: Required<QueueOpts> = Object.freeze({
  queueName: 'default',
});

// Tracks a job that should loop with a timeout and an interruptible sleep.
class WorkLoop {
  private internalWaker: { resolve: () => void; promise: Promise<void> } | undefined;
  private timeout: NodeJS.Timeout | undefined;
  private _shuttingDown = false;
  private runnerPromise: Promise<void> | undefined;

  constructor(private label: string, private pollInterval: number) {}

  // 1. Your fn should loop until workLoop.shuttingDown is true.
  // 2. When it has no work to do, it should await workLoop.sleep().
  // 3. It can be awoke with workLoop.wake().
  // 4. Remember to await workLoop.shutdown() when you're done.
  //
  // This is separate from the constructor so you can store your WorkLoop first,
  // *before* the runner starts doing things.
  run(fn: (loop: WorkLoop) => Promise<void>) {
    this.runnerPromise = fn(this);
  }

  async shutDown(): Promise<void> {
    log.trace(`[workloop %s] shutting down`, this.label);
    this._shuttingDown = true;
    this.wake();
    await this.runnerPromise;
    log.trace(`[workloop %s] completed shutdown`, this.label);
  }

  get shuttingDown(): boolean {
    return this._shuttingDown;
  }

  private get waker() {
    if (!this.internalWaker) {
      let resolve!: () => void;
      let promise = new Promise(r => {
        resolve = r;
      }) as Promise<void>;
      this.internalWaker = { promise, resolve };
    }
    return this.internalWaker;
  }

  wake() {
    log.trace(`[workloop %s] waking up`, this.label);
    this.waker.resolve();
  }

  async sleep() {
    if (this.shuttingDown) {
      return;
    }
    let timerPromise = new Promise(resolve => {
      this.timeout = setTimeout(resolve, this.pollInterval);
    });
    log.trace(`[workloop %s] entering promise race`, this.label);
    await Promise.race([this.waker.promise, timerPromise]);
    log.trace(`[workloop] leaving promise race`, this.label);
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.internalWaker = undefined;
  }
}

export default class Queue {
  pollInterval = 10000;

  private pgclient = inject('pgclient');
  private handlers: Map<string, Function> = new Map();
  private notifiers: Map<number, JobNotifier> = new Map();
  private shuttingDown = false;

  private jobRunner: WorkLoop | undefined;
  private notificationRunner: WorkLoop | undefined;

  private addNotifier(id: number, n: JobNotifier) {
    if (!this.notificationRunner && !this.shuttingDown) {
      this.notificationRunner = new WorkLoop('notificationRunner', this.pollInterval);
      this.notificationRunner.run(async loop => {
        await this.pgclient.listen('jobs_finished', loop.wake.bind(loop), async () => {
          while (!loop.shuttingDown) {
            await this.drainNotifications(loop);
            await loop.sleep();
          }
        });
      });
    }
    this.notifiers.set(id, n);
  }

  private async drainNotifications(loop: WorkLoop) {
    while (!loop.shuttingDown) {
      let waitingIds = [...this.notifiers.keys()];
      log.trace('jobs waiting for notification: %s', waitingIds);
      let result = await this.pgclient.query([
        `select id, status, result from jobs where status != 'unfulfilled' and (`,
        ...any(waitingIds.map(id => [`id=`, param(id)])),
        `)`,
      ]);
      if (result.rowCount === 0) {
        log.trace(`no jobs to notify`);
        return;
      }
      for (let row of result.rows) {
        log.trace(`notifying caller that job %s finished with %s`, row.id, row.status);
        // "!" because we only searched for rows matching our notifiers Map, and
        // we are the only code that deletes from that Map.
        let { resolve, reject } = this.notifiers.get(row.id)!;
        this.notifiers.delete(row.id);
        if (row.status === 'resolved') {
          resolve(row.result);
        } else {
          reject(row.result);
        }
      }
    }
  }

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
    log.trace(`%s created, notify jobs`, jobId);
    await this.pgclient.query([`NOTIFY jobs`]);
    return new Job(jobId, (n: JobNotifier) => this.addNotifier(jobId, n));
  }

  // Services can register async function handlers that are invoked when a job is kicked off
  register<A, T>(category: string, handler: (arg: A) => Promise<T>) {
    this.handlers.set(category, handler);
  }

  launchJobRunner() {
    if (!this.jobRunner && !this.shuttingDown) {
      this.jobRunner = new WorkLoop('jobRunner', this.pollInterval);
      this.jobRunner.run(async loop => {
        await this.pgclient.listen('jobs', loop.wake.bind(loop), async () => {
          while (!loop.shuttingDown) {
            await this.drainQueues(loop);
            await loop.sleep();
          }
        });
      });
    }
  }

  private async runJob(category: string, args: PgPrimitive) {
    let handler = this.handlers.get(category);
    if (!handler) {
      throw new Error(`unknown job handler ${category}`);
    }
    return await handler(args);
  }

  private async drainQueues(workLoop: WorkLoop) {
    await this.pgclient.withConnection(async ({ query }) => {
      while (!workLoop.shuttingDown) {
        log.trace(`draining queues`);
        await query(['BEGIN']);
        let jobs = await query([
          // find the queue with the oldest job that isn't running, and return
          // all jobs on that queue, locking them. SKIP LOCKED means we won't
          // see any jobs that are already running.
          `select * from jobs where status='unfulfilled' and queue=(select queue from jobs where status='unfulfilled' order by created_at limit 1) for update skip locked`,
        ]);
        if (jobs.rowCount === 0) {
          log.trace(`found no work`);
          await query(['ROLLBACK']);
          return;
        }
        let firstJob = jobs.rows[0];
        log.trace(`claimed queue %s which has %s unfulfilled jobs`, firstJob.queue, jobs.rowCount);
        let coalescedIds: number[] = jobs.rows
          .filter(r => r.category === firstJob.category && isEqual(r.args, firstJob.args))
          .map(r => r.id);
        let newStatus: string;
        let result: PgPrimitive;
        try {
          log.trace(`running %s`, coalescedIds);
          result = await this.runJob(firstJob.category, firstJob.args);
          newStatus = 'resolved';
        } catch (err) {
          result = serializableError(err);
          newStatus = 'rejected';
        }
        log.trace(`finished %s as %s`, coalescedIds, newStatus);
        await query([
          `update jobs set result=`,
          param(result),
          ', status=',
          param(newStatus),
          `, finished_at=now() where `,
          ...any(coalescedIds.map(id => [`id=`, param(id)])),
        ]);
        // NOTIFY takes effect when the transaction actually commits. If it
        // doesn't commit, no notification goes out.
        await query([`NOTIFY jobs_finished`]);
        await query(['COMMIT']);
        log.trace(`committed job completions, notified jobs_finished`);
      }
    });
  }

  async willTeardown() {
    this.shuttingDown = true;
    if (this.jobRunner) {
      await this.jobRunner.shutDown();
    }
    if (this.notificationRunner) {
      await this.notificationRunner.shutDown();
    }
  }
}

function serializableError(err: any): Record<string, any> {
  try {
    let result = Object.create(null);
    for (let field of Object.getOwnPropertyNames(err)) {
      result[field] = err[field];
    }
    return result;
  } catch (megaError) {
    let stringish: string | undefined;
    try {
      stringish = String(err);
    } catch (_ignored) {
      // ignoring
    }
    return {
      failedToSerializeError: true,
      string: stringish,
    };
  }
}

export class Job<T> {
  constructor(public id: number, private addNotifier: (n: JobNotifier) => void) {}
  @Memoize()
  get done(): Promise<T> {
    return new Promise((resolve, reject) => {
      this.addNotifier({ resolve, reject });
    });
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    queue: Queue;
  }
}
