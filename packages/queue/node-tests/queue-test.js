const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');

const delay = require('delay');


describe('@cardstack/queue', function() {
  let env, queue;

  async function setup() {
    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`);

    queue = env.lookup('hub:queues');
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  beforeEach(setup);
  afterEach(teardown);

  it('can publish a job ', async function() {
    await queue.publish('test-job');
  });

  it('can subscribe to a job', async function() {
    let isDone = false;
    await queue.publish('test-job');
    let handler = () => {
      isDone = true;
    };
    await queue.subscribe('test-job', handler);
    await delay(500);
    expect(isDone).to.be.ok;
  });

  it('can return a promise that resolves after a job is complete', async function() {
    let isDoneWithoutWait = false, isDoneWithWait = false;

    let noWaitWorker = () => {
      isDoneWithoutWait = true;
    };
    await queue.subscribe('long-job-without-wait', noWaitWorker);

    expect(isDoneWithoutWait).to.not.be.ok;

    await queue.publish('long-job-without-wait');

    expect(isDoneWithoutWait).to.not.be.ok;

    let waitWorker = () => {
      isDoneWithWait = true;
    };

    await queue.subscribe('long-job-with-wait', waitWorker);
    expect(isDoneWithWait).to.not.be.ok;

    let result = await queue.publishAndWait('long-job-with-wait');
    expect(isDoneWithWait).to.be.ok;
    expect(result.name).to.equal("long-job-with-wait__state__complete");

  }).timeout(4000);


  it('completes immediately if workers do not return a promise', function(done) {
    (async () => {
      let isDone = false;

      let worker = () => {
        setTimeout(() => {
          isDone = true;
          done();
        }, 1000);
      };

      await queue.subscribe('timeout-job', worker);

      await queue.publishAndWait('timeout-job');

      expect(isDone).to.be.falsy;
      // it didn't wait, because the worker didn't return a promise
    })();
  }).timeout(4000);

  it('waits for promises in workers', async function() {
    let isDone = false;

    let worker = () => {
      return new Promise(resolve => {
        setTimeout(() => {
          isDone = true;
          resolve();
        }, 1000);
      });
    };

    await queue.subscribe('promise-job', worker);

    await queue.publishAndWait('promise-job');
    expect(isDone).to.be.ok;
  }).timeout(4000);

  it('waits for async workers', async function() {
    let isDone = false;

    let worker = async () => {
      await delay(1000);
      isDone = true;
    };

    await queue.subscribe('async-job', worker);

    await queue.publishAndWait('async-job');
    expect(isDone).to.be.ok;
  }).timeout(4000);

  it('the result of the job is returned to the waiter', async function() {

    let worker = async () => {
      await delay(10);
      return {outcome: "it worked!"};
    };

    await queue.subscribe('async-job', worker);

    let result = await queue.publishAndWait('async-job');
    expect(result.data.response.outcome).to.equal("it worked!");
  }).timeout(4000);

  it('handles sync errors', async function() {
    let worker = () => {
      throw new Error("sync error");
    };

    await queue.subscribe('sync-error-job', worker);
    try {
      await queue.publishAndWait('sync-error-job');
      expect(false).to.be.ok("should not get here");
    } catch (e) {
      expect(e.message).to.equal("sync error");
    }
  }).timeout(4000);

  it('handles async errors', async function() {
    let worker = async () => {
      await delay(100);
      throw new Error("async error");
    };

    await queue.subscribe('async-error-job', worker);
    try {
      await queue.publishAndWait('async-error-job');
      expect(false).to.be.ok("should not get here");
    } catch (e) {
      expect(e.message).to.equal("async error");
    }
  }).timeout(4000);

  it('cleans up state', async function() {
    let worker = () => {
      throw new Error("sync error");
    };

    await queue.subscribe('cleanup-job', worker);
    try {
      await queue.publishAndWait('cleanup-job');
      expect(false).to.be.ok("should not get here");
    } catch (e) {
      expect(e.message).to.equal("sync error");
    }

    expect(Object.keys(queue.jobErrors).length).to.equal(0);
    expect(Object.keys(queue.promiseResolveCallbacks).length).to.equal(0);
    expect(Object.keys(queue.promiseRejectCallbacks).length).to.equal(0);
  }).timeout(4000);

  it('works with multiple publishes', async function() {
    let workCount = 0;
    let worker = () => {
      workCount += 1;
    };

    await queue.subscribe('test-multiple-job', worker);

    await queue.publishAndWait('test-multiple-job');
    await queue.publishAndWait('test-multiple-job');

    expect(workCount).to.equal(2);
  }).timeout(8000);

  it('sends data to the job', async function() {
    let worker = ({data}) => {
      expect(data.foo).to.equal(123);
    };
    await queue.subscribe('test-job', worker);
    await queue.publishAndWait('test-job', {foo: 123});
  }).timeout(4000);


});
