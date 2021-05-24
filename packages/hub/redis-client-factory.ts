import { WrappedNodeRedisClient } from 'handy-redis';
import { FactoryByCreateMethod } from './container';
import { createNodeRedisClient } from 'handy-redis';

export class RedisClientFactory implements FactoryByCreateMethod<WrappedNodeRedisClient> {
  create(): WrappedNodeRedisClient {
    return createNodeRedisClient();
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'redis-client': WrappedNodeRedisClient;
  }
}
