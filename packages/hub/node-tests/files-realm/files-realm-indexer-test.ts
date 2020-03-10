import { ScopedCardService } from '../../cards-service';
import { myOrigin } from '@cardstack/core/origin';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { Session } from '@cardstack/core/session';
import { createTestEnv, TestEnv } from '../helpers';
import { cardDocument, CardDocument } from '@cardstack/core/card-document';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import IndexingService from '../../indexing';
import { outputJSONSync, removeSync, outputFileSync } from 'fs-extra';
import { join } from 'path';
import { Card } from '@cardstack/core/card';
import { FilesTracker } from '@cardstack/files-realm-card/tracker';

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
    manuallyCreateCard(join(filesPath, 'first-card'), {
      cardDocument: cardDocument().withAttributes({
        csId: 'first-card',
        csDescription: 'The first card',
        csFiles: { 'example.hbs': 'Hello world' },
      }),
    });
    manuallyCreateCard(join(filesPath, 'second-card'), {
      cardDocument: cardDocument().withAttributes({ csId: 'second-card', csDescription: 'The second card' }),
    });
  });

  afterEach(async function() {
    await env.destroy();
    await tmpDir.cleanup();
  });

  it('finds newly added card', async function() {
    await indexing.update();

    let { cards } = await service.search({ filter: { eq: { csRealm: filesRealm, csId: 'my-card' } } });
    expect(cards).lengthOf(0);

    manuallyCreateCard(join(filesPath, 'my-card'), {
      cardDocument: cardDocument().withAttributes({ csId: 'my-card', csDescription: 'My Card' }),
    });

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
});

function manuallyCreateCard(cardPath: string, opts: { packageJSON?: any; cardDocument: CardDocument }) {
  let cardJSON = opts.cardDocument.jsonapi;
  if (cardJSON.data.attributes?.csFiles) {
    writeCSFiles(cardPath, cardJSON.data.attributes?.csFiles as NonNullable<Card['csFiles']>);
    delete cardJSON.data.attributes.csFiles;
  }
  outputJSONSync(join(cardPath, 'package.json'), opts.packageJSON ?? {});
  outputJSONSync(join(cardPath, 'card.json'), cardJSON);
}

function writeCSFiles(outDir: string, files: NonNullable<Card['csFiles']>) {
  for (let [name, entry] of Object.entries(files)) {
    if (typeof entry === 'string') {
      outputFileSync(join(outDir, name), entry, 'utf8');
    } else {
      writeCSFiles(join(outDir, name), entry);
    }
  }
}
