import { inject } from './dependency-injection';
import { WrappedNodeRedisClient } from 'handy-redis';

// The container-resident instance of this class has `onShutdown` called when the koa server is being closed.
// Inject instances that need to do some cleanup in this situation and do what you need to.
// If anything remains bound to a port, it will prevent a clean exit and/or test completion.

export class ShutdownHelper {
  redisClient: WrappedNodeRedisClient = inject('redis-client', { as: 'redisClient' });

  async onShutdown() {
    await this.redisClient.quit();
  }
}
