import { TestEnv, createTestEnv } from './helpers';
import Queue from '../queue/queue';

describe('hub/queue', function() {
  let env: TestEnv;
  let queue: Queue;

  beforeEach(async function() {
    env = await createTestEnv();
    queue = await env.container.lookup('queue');
  });

  afterEach(async function() {
    await env.destroy();
  });

  it.skip('it can run a job', async function() {
    let job = await queue.publish('plus1', 17);
    queue.subscribe('plus1', async (a: number) => a + 1);
    let result = await job.done;
    expect(result).equals(18);
  });
});
