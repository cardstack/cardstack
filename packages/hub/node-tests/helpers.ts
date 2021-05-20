import { wireItUp } from '../main';
import { Container, RegistryCallback } from '../dependency-injection';

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
