import { wireItUp } from '../main';
import { Container } from '../dependency-injection';
import PgClient from '../pgsearch/pgclient';
import { emptyDir } from 'fs-extra';
import { cardFilesCache } from '../module-service';
import { Session } from '../session';
import { cardDocument } from '../card-document';
import { myOrigin } from '../origin';
import { CARDSTACK_PUBLIC_REALM } from '../realm';

export interface TestEnv {
  container: Container;
  destroy(): Promise<void>;
}

export async function seedTestRealms(container: Container): Promise<void> {
  let cards = (await container.lookup('cards')).as(Session.INTERNAL_PRIVILEGED);
  const metaRealm = `${myOrigin}/api/realms/meta`;

  await cards.create(
    metaRealm,
    cardDocument()
      .withAttributes({
        csRealm: metaRealm,
        csId: metaRealm,
      })
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
  );
  await cards.create(
    metaRealm,
    cardDocument()
      .withAttributes({
        csRealm: metaRealm,
        csId: `${myOrigin}/api/realms/first-ephemeral-realm`,
      })
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
  );
  await cards.create(
    metaRealm,
    cardDocument()
      .withAutoAttributes({
        csRealm: metaRealm,
        csOriginalRealm: `http://example.com/api/realms/meta`,
        csId: `http://example.com/api/realms/second-ephemeral-realm`,
      })
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
  );
}

export async function createTestEnv(): Promise<TestEnv> {
  process.env.PGDATABASE = `test_db_${Math.floor(100000 * Math.random())}`;
  let container = await wireItUp();
  await seedTestRealms(container);
  (await container.lookup('queue')).launchJobRunner();
  return { container, destroy };
}

async function destroy(this: TestEnv) {
  await this.container.teardown();
  await PgClient.deleteSearchIndexIHopeYouKnowWhatYouAreDoing();
  await emptyDir(cardFilesCache);
}
