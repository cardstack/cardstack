import { wireItUp } from '../main';
import { Container, RegistryCallback } from '../di/dependency-injection';

export interface TestEnv {
  container: Container;
  destroy(): Promise<void>;
}

export async function createTestEnv(registryCallBack?: RegistryCallback): Promise<TestEnv> {
  let container = await wireItUp(registryCallBack);
  async function destroy() {
    await container.teardown();
  }
  return { container, destroy };
}

export class AcceleratableClock {
  acceleratedByMs = 0;
  get acceleratedByNs(): bigint {
    return BigInt(this.acceleratedByMs) * BigInt(1000);
  }

  now() {
    return Date.now() + this.acceleratedByMs;
  }
  hrNow() {
    return process.hrtime.bigint() + this.acceleratedByNs;
  }
}
