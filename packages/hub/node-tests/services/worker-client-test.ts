import WorkerClient from '../../services/worker-client';
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
      await subject.addJob('foo');
      expect.fail('Should not reach here');
    } catch (e) {
      expect(e.message).to.equal('Cannot call addJob before workerUtils is ready');
    }
  });

  it('can add a job after ready', async function () {
    await subject.ready();
    let job = await subject.addJob('foo');
    expect(job.task_identifier).to.equal('foo');
  });
});
