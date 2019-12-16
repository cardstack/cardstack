import { inject } from '../dependency-injection';
import { param, PgPrimitive, Expression, separatedByCommas, addExplicitParens, any } from '../pgsearch/util';
import { Memoize } from 'typescript-memoize';
import isEqual from 'lodash/isEqual';

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
  private internalWake: (() => void) | undefined;
  private timeout: NodeJS.Timeout | undefined;
  private _shuttingDown = false;
  private runnerPromise: Promise<void>;

  // 1. Your fn should loop until workLoop.shuttingDown is true.
  // 2. When it has no work to do, it should await workLoop.sleep().
  // 3. It can be awoke with workLoop.wake().
  // 4. Remember to await workLoop.shutdown() when you're done.
  constructor(private pollIntervalMS: number, private fn: (workLoop: WorkLoop) => Promise<void>) {
    this.runnerPromise = this.fn(this);
  }

  async shutDown(): Promise<void> {
    this._shuttingDown = true;
    this.wake();
    await this.runnerPromise;
  }

  get shuttingDown(): boolean {
    return this._shuttingDown;
  }

  wake() {
    if (this.internalWake) {
      this.internalWake();
    }
  }

  async sleep() {
    if (this.shuttingDown) {
      return;
    }
    let sleepPromise = new Promise(resolve => {
      this.internalWake = resolve;
    });
    let timerPromise = new Promise(resolve => {
      this.timeout = setTimeout(resolve, this.pollIntervalMS);
    });
    await Promise.race([sleepPromise, timerPromise]);
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.internalWake = undefined;
  }
}

export default class Queue {
  pollInterval = 10000;

  private pgclient = inject('pgclient');
  private handlers: Map<string, Function> = new Map();
  private notifiers: Map<number, JobNotifier> = new Map();

  private jobRunner: WorkLoop | undefined;

  private notificationRunner: WorkLoop | undefined;

  private addNotifier(id: number, n: JobNotifier) {
    if (!this.notificationRunner) {
      this.notificationRunner = new WorkLoop(this.pollInterval, async loop => {
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
      let result = await this.pgclient.query([
        `select id, status, result from jobs where status != 'unfulfilled' and (`,
        ...any(waitingIds.map(id => [`id=`, param(id)])),
        `)`,
      ]);
      if (result.rowCount === 0) {
        return;
      }
      for (let row of result.rows) {
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
    await this.pgclient.query([`NOTIFY jobs`]);
    return new Job(jobId, (n: JobNotifier) => this.addNotifier(jobId, n));
  }

  // Services can register async function handlers that are invoked when a job is kicked off
  register<A, T>(category: string, handler: (arg: A) => Promise<T>) {
    this.handlers.set(category, handler);
  }

  launchJobRunner() {
    if (!this.jobRunner) {
      this.jobRunner = new WorkLoop(this.pollInterval, async loop => {
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
        await query(['BEGIN']);
        let jobs = await query([
          // find the queue with the oldest job that isn't running, and return
          // all jobs on that queue, locking them. SKIP LOCKED means we won't
          // see any jobs that are already running.
          `select * from jobs where queue=(select queue from jobs where status='unfulfilled' order by created_at limit 1) for update skip locked`,
        ]);
        if (jobs.rowCount === 0) {
          return;
        }
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
        await query(['COMMIT']);
        await query([`NOTIFY jobs_finished`]);
      }
    });
  }

  async teardown() {
    if (this.jobRunner) {
      await this.jobRunner.shutDown();
    }
    if (this.notificationRunner) {
      await this.notificationRunner.shutDown();
    }
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
