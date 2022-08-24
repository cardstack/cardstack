import { KnownTasks } from '@cardstack/hub/tasks';
import WorkerClient from '../../services/worker-client';

let FAKE_KNOWN_TASK = 'FAKE_KNOWN_TASK' as keyof KnownTasks;

describe('WorkerClient', function () {
  let subject: WorkerClient;

  this.beforeEach(function () {
    subject = new WorkerClient();
  });

  this.afterEach(function () {
    subject.teardown();
  });

  it('cannot add job before ready', async function () {
    try {
      await subject.addJob(FAKE_KNOWN_TASK);
      expect.fail('Should not reach here');
    } catch (e: any) {
      expect(e.message).to.equal('Cannot call addJob before workerUtils is ready');
    }
  });

  it('can add a job after ready', async function () {
    await subject.ready();
    let job = await subject.addJob(FAKE_KNOWN_TASK);
    expect(job.task_identifier).to.equal(FAKE_KNOWN_TASK);
  });

  it('can apply default priorities to a job', async function () {
    await subject.ready();
    subject.defaultPriorities[FAKE_KNOWN_TASK] = 1;
    let job = await subject.addJob(FAKE_KNOWN_TASK);
    expect(subject.defaultPriorities[FAKE_KNOWN_TASK]).to.equal(1);
    expect(job.task_identifier).to.equal(FAKE_KNOWN_TASK);
    expect(job.priority).to.equal(1);
  });

  it('can respect priority overrides', async function () {
    await subject.ready();
    subject.defaultPriorities[FAKE_KNOWN_TASK] = 1;
    let job = await subject.addJob(FAKE_KNOWN_TASK, undefined, { priority: 2 });
    expect(subject.defaultPriorities[FAKE_KNOWN_TASK]).to.equal(1);
    expect(job.task_identifier).to.equal(FAKE_KNOWN_TASK);
    expect(job.priority).to.equal(2);
  });

  it('leaves priority unset if there is no default', async function () {
    await subject.ready();
    let job = await subject.addJob(FAKE_KNOWN_TASK);
    expect(subject.defaultPriorities[FAKE_KNOWN_TASK]).to.equal(undefined);
    expect(job.task_identifier).to.equal(FAKE_KNOWN_TASK);
    // here we're expecting we get graphile's default of 0, which is the highest priority
    expect(job.priority).to.equal(0);
  });
});
