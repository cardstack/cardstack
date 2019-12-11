import * as JSON from 'json-typescript';

export interface JobArgs {
  [key: string]: JSON.Value;
}
export interface QueueOptions {
  coalesceWaitingJobs?: boolean;
}

export default class Queue {
  private handlers: Map<string, Function> = new Map();
  private runningJobs: Map<string, Promise<void>> = new Map();
  private waitingJobs: Map<string, Promise<void>> = new Map();

  // 0. make sure handler exists for job name, throw otherwise
  // 1. create a deferred promise for the handler function that corresponds to
  //    the job name and curry the job args for the handler function
  // 2. hash job name (i think advisory lock operate on ints) and try to get
  //    advisory lock for the job name.
  // 3. if we are able to get lock then add the job promise to the running jobs
  //    and return the promise. Presumably there should be no existing running
  //    job already for that job name. 4a. if we are unable to get lock then add
  //    job promise to the this.watitingJobs.
  // 4. If there is already an entry in waitingJobs for this job name, and we
  //    are coalescing jobs, then return the current this.waitingJobs.get(name)
  //    promise instead of the one that was constructed at the beginning in step
  //    #1. Otherwise chain the promise to the end of the promise that exists in
  //    this.waitingJobs and return the chained promise
  // 5. if in step #4 where we were unable to get a lock, look for the job name
  //    in running jobs. If If we cannot find the running job, then that means
  //    the running job is in another node runtime (a 2nd hub instance has spun
  //    up) and start polling for an advisory lock for the job name. Once a lock
  //    is obtained, follow logic in step #6.
  // 6. When a running handler job has completed (or failed) as part of a
  //    finally block, look for this.waitingJobs(name) deferred promises. If you
  //    find any, then remove that promise from the this.waitingJobs and add it
  //    to the this.runningJobs and start executing that job's handler function.
  //    If there are no waiting jobs, then release the advisory lock. Note that
  //    the lock is held until all the jobs in this hub instances for the job
  //    name have been flushed. This allows hub hub instance to complete it's
  //    processing of jobs before another hub instance can start processing the
  //    same job name's.

  async publish(name: string, args: JobArgs, opts: QueueOptions): Promise<void> {}

  // Services can register async function handlers that are invoked when a job is kicked off
  // for the job "name"
  subscribe(name: string, handler: Function) {
    this.handlers.set(name, handler);
  }

  unsubscribe(name: string) {
    this.handlers.delete(name);
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    queue: Queue;
  }
}
