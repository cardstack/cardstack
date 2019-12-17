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

  it('it can run a job', async function() {
    let job = await queue.publish('increment', 17, { queueName: 'first-ephemeral-realm-incrementing' });
    queue.register('increment', async (a: number) => a + 1);
    let result = await job.done;
    expect(result).equals(18);
  });
});
