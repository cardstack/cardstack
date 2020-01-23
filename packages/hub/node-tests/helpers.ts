import { wireItUp } from '../main';
import { Container } from '../dependency-injection';
import PgClient from '../pgsearch/pgclient';
import { emptyDir } from 'fs-extra';
import { cardFilesCache } from '../module-service';

export interface TestEnv {
  container: Container;
  destroy(): Promise<void>;
}

export async function createTestEnv(): Promise<TestEnv> {
  process.env.PGDATABASE = `test_db_${Math.floor(100000 * Math.random())}`;
  let container = await wireItUp();
  (await container.lookup('queue')).launchJobRunner();
  return { container, destroy };
}

async function destroy(this: TestEnv) {
  await this.container.teardown();
  await PgClient.deleteSearchIndexIHopeYouKnowWhatYouAreDoing();
  await emptyDir(cardFilesCache);
}
