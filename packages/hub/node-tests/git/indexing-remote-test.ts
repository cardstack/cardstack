import { TestEnv, createTestEnv } from '../helpers';
import GitService from '@cardstack/git-realm-card/lib/service';
import IndexingService from '../../indexing';
import { cardDocument, CardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import CardsService, { ScopedCardService } from '../../cards-service';
import { Session } from '@cardstack/core/session';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { Remote, Repository } from '@cardstack/git-realm-card/lib/git';
import Change from '@cardstack/git-realm-card/lib/change';
import { commitOpts, makeRepo, inRepo } from './support';
import stringify from 'json-stable-stringify';

async function resetRemote() {
  let tmpDir = await (await mkTmpDir({ unsafeCleanup: true })).path;
  let tempRepo = await makeRepo(tmpDir, {
    'cards/event-1/card.json': stringify(
      cardDocument()
        .withField('title', 'string-field')
        .withAttributes({ csId: 'event-1', title: 'hello world' }).jsonapi,
      { space: 2 }
    ),
    'cards/event-1/package.json': '{}',
    'cards/event-2/card.json': stringify(
      cardDocument()
        .withField('title', 'string-field')
        .withAttributes({ csId: 'event-2', title: 'goodbye world' }).jsonapi,
      { space: 2 }
    ),
    'cards/event-2/package.json': '{}',
  });

  let remote = await Remote.create(tempRepo.repo, 'origin', 'http://root:password@localhost:8838/git/repo');
  await remote.push('refs/heads/master', 'refs/heads/master', { force: true });

  return tempRepo;
}
describe('hub/git/indexing-remote', function() {
  let env: TestEnv, indexing: IndexingService, cards: CardsService, service: ScopedCardService;
  let repoRealm = `${myOrigin}/api/realms/test-git-repo`;
  let head: string;
  let remoteRepo: Repository;
  let csRealm: string;
  let repoDoc: CardDocument;
  let tempRepoDir: DirectoryResult;
  let tempRemoteRepoDir: DirectoryResult;
  let tempRemoteRepoPath: string;

  beforeEach(async function() {
    env = await createTestEnv();
    indexing = await env.container.lookup('indexing');
    cards = await env.container.lookup('cards');
    service = cards.as(Session.EVERYONE);

    ({ head, repo: remoteRepo } = await resetRemote());

    tempRepoDir = await mkTmpDir({ unsafeCleanup: true });
    tempRemoteRepoDir = await mkTmpDir({ unsafeCleanup: true });
    process.env.REPO_ROOT_DIR = tempRepoDir.path;
    tempRemoteRepoPath = tempRemoteRepoDir.path;
    let remoteCacheDir = 'test-repo';

    await Repository.clone('http://root:password@localhost:8838/git/repo', tempRemoteRepoPath);

    repoDoc = cardDocument()
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'git-realm' })
      .withAttributes({
        remoteUrl: 'http://root:password@localhost:8838/git/repo',
        remoteCacheDir,
        csId: repoRealm,
      });

    ({ csId: csRealm } = await service.create(`${myOrigin}/api/realms/meta`, repoDoc.jsonapi));
  });

  afterEach(async function() {
    await tempRepoDir.cleanup();
    await tempRemoteRepoDir.cleanup();
    await env.destroy();
    GitService.clearCache();
  });

  it('clones the remote repo', async function() {
    await indexing.update();
    let indexerState = await indexing.loadMeta(repoRealm);
    expect(indexerState!.commit).to.equal(head);
  });

  it('indexes existing data in the remote after it is cloned', async function() {
    await indexing.update();

    let foundCard = await service.get({ csRealm: repoRealm, csId: 'event-1' });
    expect(await foundCard.value('title')).to.equal('hello world');
    foundCard = await service.get({ csRealm: repoRealm, csId: 'event-2' });
    expect(await foundCard.value('title')).to.equal('goodbye world');
  });

  it('indexes updated card', async function() {
    await indexing.update(); // we want the next indexing to be incremental

    let change = await Change.create(remoteRepo, head, 'master');
    let file = await change.get(`cards/event-1/card.json`, { allowUpdate: true });
    file.setContent(
      stringify(
        cardDocument().withAutoAttributes({
          csId: 'event-1',
          title: 'updated title',
        }).jsonapi,
        { space: 2 }
      )
    );
    await change.finalize(commitOpts());
    await inRepo(remoteRepo.path).push();

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    let updatedCard = await service.get({ csRealm, csId: 'event-1' });
    expect(await updatedCard.value('title')).to.equal('updated title');
  });

  it('indexes card with inner file', async function() {
    await indexing.update(); // we want the next indexing to be incremental

    let change = await Change.create(remoteRepo, head, 'master');
    let file = await change.get(`cards/event-1/inner/example.hbs`, { allowCreate: true });
    file.setContent('Hello World');
    head = await change.finalize(commitOpts());
    await inRepo(remoteRepo.path).push();

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    let updatedCard = await service.get({ csRealm, csId: 'event-1' });
    expect(updatedCard.csFiles).to.deep.equal({
      inner: { 'example.hbs': 'Hello World' },
    });
  });

  it('removes a card that is no longer in git', async function() {
    await indexing.update(); // we want the next indexing to be incremental
    let card = await service.get({ csRealm, csId: 'event-1' });
    expect(card).to.be.ok;

    let change = await Change.create(remoteRepo, head, 'master');
    let file = await change.get(`cards/event-1/card.json`);
    file.delete();
    file = await change.get(`cards/event-1/package.json`);
    file.delete();
    await change.finalize(commitOpts());
    await inRepo(remoteRepo.path).push();

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    try {
      await service.get({ csRealm, csId: 'event-1' });
      throw new Error(`Should not be able to get the card`);
    } catch (e) {
      expect(e).hasStatus(404);
    }
  });
});
