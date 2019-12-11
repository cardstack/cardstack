import * as JSON from 'json-typescript';

export interface JobArgs {
  [key: string]: JSON.Value;
}
export interface QueueOptions {
  coalesceWaitingJobs?: boolean;
}

export default class Queue {
  private handlers: Map<string, Function> = new Map();
  private jobs: Map<string, Promise<void>> = new Map();

  async ready() {
    // pg migrate the jobs DB schema with columns: id (seq number), name, args,
    // status, publish-time
    //
    // statuses:
    //   - waiting: job is waiting to be started
    //   - running: job is running
    //   - completed: job has completed successsfully but submitter has not yet
    //     been informed
    //   - failed: job has completed unsuccessfully but submitter has not yet
    //     been informed
    //   - fulfilled: job submitter has been informed about the success of the
    //     job
    //   - rejected: job submitter has been informed about teh failure of the
    //     job
    //
    // Execute this.lookForWorkToDo() to start polling for jobs that were
    // submitted by other hubs. Note that we shouldn't run this polling during
    // tests...
    //
    // execute this.lookForCompletedWork() to start polling for jobs that your
    // hub has submitted that were completed by other hubs. Note that we
    // shouldn't run this polling during tests
  }

  async publish(name: string, args: JobArgs, opts: QueueOptions): Promise<void> {
    // 1. assert that handler exists for job name, otherwise throw
    // 2. if opts.coaleseWaitingJobs is true and there is alread an entry for
    //    this job name in the jobs table that is in a waiting status, then do
    //    not create a new row
    // 2. add new row to jobs table with state of "waiting" include name args,
    //    opts, publish-time in jobs row.
    // 3. create a promise that will be fulfilled when the job is completed and
    //    add to the this.jobs map with the created (or coalesced) row's job id
    // 4. invoke this.runNextJob(name)
  }

  // Services can register async function handlers that are invoked when a job is kicked off
  // for the job "name"
  subscribe(name: string, handler: Function) {
    this.handlers.set(name, handler);
  }

  unsubscribe(name: string) {
    this.handlers.delete(name);
  }

  private async runNextJob(name: string) {
    // 1. try to get advisory lock for the job name (may need to hash job name
    //    to an int)
    // 2. if no advisory lock can be obtained then exit this function
    // 3. if an advisory lock can be obtained, then select the next waiting job
    //    for the job name and update the job's status to "running"
    // 4. invoke the handler for the job name with the args that were in the
    //    selected job in step #3
    // 5. when the handler function completes (or fails--use "finally"). update
    //    the status of the job in the DB to "completed" or "failed" and release
    //    the advisory lock.
    // 6. if this.jobs(jobId) has a promise then resolve (or reject it as the
    //    case may be) it (otherwise the promise lives in another hub). Update
    //    the status to the job to indicate that the job submitter has been
    //    informed (set job status to fulfilled or rejected state)
    // 7. execute this.runNextJob(name) recursivey to pick up any more waiting
    //    jobs for this job name.
  }

  // This will pick up any jobs that were not submitted by this hub
  private lookForWorkToDo() {
    setInterval(() => {
      // for all the keys in this.handlers, call this.runNextJob(name)
    });
  }

  private lookForCompletedWork() {
    setInterval(() => {
      // for all the keys in this.jobs, look for any completed or failed jobs.
      // For each job resolve or reject the job promise and update the job row
      // in the DB to reflect that we have informed the job submitter the state
      // of the job
    });
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    queue: Queue;
  }
}
