import { ScopedCardService } from '../../cards-service';
import { myOrigin } from '@cardstack/core/origin';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { Session } from '@cardstack/core/session';
import { createTestEnv, TestEnv } from '../helpers';
import { cardDocument } from '@cardstack/core/card-document';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import IndexingService from '../../indexing';
import { removeSync, outputFileSync } from 'fs-extra';
import { join } from 'path';
import { FilesTracker } from '@cardstack/files-realm-card/tracker';
import { writeCard } from '@cardstack/core/card-file';
import { SingleResourceDoc } from 'jsonapi-typescript';

describe('hub/files-realm/indexer', function() {
  this.timeout(10000);
  let env: TestEnv;
  let service: ScopedCardService;
  let filesRealm = `${myOrigin}/api/realms/test-files-realm`;
  let filesDoc;
  let filesPath: string;
  let tmpDir: DirectoryResult;
  let indexing: IndexingService;
  let tracker: FilesTracker;

  beforeEach(async function() {
    env = await createTestEnv();
    service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
    indexing = await env.container.lookup('indexing');
    tracker = await env.container.lookup('filesTracker');

    tmpDir = await mkTmpDir({ unsafeCleanup: true });
    filesPath = tmpDir.path;

    filesDoc = cardDocument()
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'files-realm' })
      .withAttributes({ directory: filesPath, csId: filesRealm });

    await service.create(`${myOrigin}/api/realms/meta`, filesDoc.jsonapi);
    await makeCard(
      join(filesPath, 'first-card'),
      cardDocument().withAttributes({
        csId: 'first-card',
        csDescription: 'The first card',
        csFiles: { 'example.hbs': 'Hello world' },
      }).jsonapi
    );
    await makeCard(
      join(filesPath, 'second-card'),
      cardDocument().withAttributes({ csId: 'second-card', csDescription: 'The second card' }).jsonapi
    );
  });

  afterEach(async function() {
    await env.destroy();
    await tmpDir.cleanup();
  });

  it('finds newly added card', async function() {
    await indexing.update();

    let { cards } = await service.search({ filter: { eq: { csRealm: filesRealm, csId: 'my-card' } } });
    expect(cards).lengthOf(0);

    await makeCard(
      join(filesPath, 'my-card'),
      cardDocument().withAttributes({ csId: 'my-card', csDescription: 'My Card' }).jsonapi
    );

    let count = tracker.operationsCount;
    await indexing.update();
    expect(tracker.operationsCount).to.equal(count + 1, 'wrong number of operations');

    ({ cards } = await service.search({ filter: { eq: { csRealm: filesRealm, csId: 'my-card' } } }));
    expect(cards).lengthOf(1);
    expect(cards[0].csDescription).to.equal('My Card');
  });

  it('updates a changed card', async function() {
    let query = { filter: { eq: { csRealm: filesRealm, csId: 'first-card' } } };
    await indexing.update();

    let { cards } = await service.search(query);
    expect(cards).lengthOf(1);
    expect(cards[0].csFiles?.['example.hbs']).to.equal('Hello world');

    outputFileSync(join(filesPath, 'first-card', 'example.hbs'), 'Goodbye');

    let count = tracker.operationsCount;
    await indexing.update();
    expect(tracker.operationsCount).to.equal(count + 1, 'wrong number of operations');

    ({ cards } = await service.search(query));
    expect(cards).lengthOf(1);
    expect(cards[0].csFiles?.['example.hbs']).to.equal('Goodbye');
  });

  it('updates card with newly added csFile', async function() {
    let query = { filter: { eq: { csRealm: filesRealm, csId: 'first-card' } } };
    await indexing.update();

    let { cards } = await service.search(query);
    expect(cards).lengthOf(1);
    expect(cards[0].csFiles?.['example.hbs']).to.equal('Hello world');

    outputFileSync(join(filesPath, 'first-card', 'inner', 'new.hbs'), 'New File');

    let count = tracker.operationsCount;
    await indexing.update();
    expect(tracker.operationsCount).to.equal(count + 1, 'wrong number of operations');

    ({ cards } = await service.search(query));
    expect(cards).lengthOf(1);
    expect((cards[0].csFiles?.['inner'] as any)?.['new.hbs']).to.equal('New File');
  });

  it('updates card with removed csFile', async function() {
    let query = { filter: { eq: { csRealm: filesRealm, csId: 'first-card' } } };
    await indexing.update();

    let { cards } = await service.search(query);
    expect(cards).lengthOf(1);
    expect(cards[0].csFiles?.['example.hbs']).to.equal('Hello world');

    removeSync(join(filesPath, 'first-card', 'example.hbs'));

    let count = tracker.operationsCount;
    await indexing.update();
    expect(tracker.operationsCount).to.equal(count + 1, 'wrong number of operations');

    ({ cards } = await service.search(query));
    expect(cards).lengthOf(1);
    expect(cards[0].csFiles).deep.equal({});
  });

  it('removes a deleted card', async function() {
    let query = {
      filter: {
        any: [
          { eq: { csRealm: filesRealm, csId: 'first-card' } },
          { eq: { csRealm: filesRealm, csId: 'second-card' } },
        ],
      },
    };

    await indexing.update();

    let { cards } = await service.search(query);
    expect(cards).lengthOf(2);

    removeSync(join(filesPath, 'first-card'));

    let count = tracker.operationsCount;
    await indexing.update();
    expect(tracker.operationsCount).to.equal(count + 1, 'wrong number of operations');

    ({ cards } = await service.search(query));
    expect(cards).lengthOf(1);
    expect(cards[0].csDescription).to.equal('The second card');
  });

  it('updates a card when notified about a file change', async function() {
    let filename = join(filesPath, 'first-card', 'example.hbs');
    outputFileSync(filename, 'Goodbye');
    tracker.notifyFileDidChange(filename);
    await tracker.somePromiseGoesHere();
  });

  it('updates a card when notified about a file that was deleted', async function() {});
  it('deletes a card when notified about a file change', async function() {});
});

async function makeCard(path: string, doc: SingleResourceDoc) {
  await writeCard(path, doc, async (path: string, contents: string) => {
    outputFileSync(path, contents, 'utf8');
  });
}
