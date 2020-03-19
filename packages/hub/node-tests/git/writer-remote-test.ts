import { Repository, Remote } from '../../../../cards/git-realm/lib/git';
import GitService from '@cardstack/git-realm-card/lib/service';
import { TestEnv, createTestEnv } from '../helpers';
import { cardDocument, CardDocument } from '@cardstack/core/card-document';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { myOrigin } from '../../origin';
import { ScopedCardService } from '../../cards-service';
import { Session } from '@cardstack/core/session';

import { makeRepo, inRepo } from './support';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import { AddressableCard } from '@cardstack/core/card';
import Change from '@cardstack/git-realm-card/lib/change';
import stringify from 'json-stable-stringify';
import IndexingService from '../../indexing';

const repoRealm = `${myOrigin}/api/realms/test-git-repo`;
let rootDir: DirectoryResult;

async function resetRemote() {
  rootDir = await mkTmpDir({ unsafeCleanup: true });
  let root = rootDir.path;

  let tempRepo = await makeRepo(root, {
    'cards/event-1/card.json': stringify(
      cardDocument().withAutoAttributes({
        csId: 'event-1',
        title: 'This is a test event',
        publishedDate: '2018-09-25',
      }).jsonapi,
      { space: 2 }
    ),
    'cards/event-1/package.json': '{}',
    'cards/event-2/card.json': stringify(
      cardDocument().withAutoAttributes({
        csId: 'event-2',
        title: 'This is another test event',
        publishedDate: '2018-10-25',
      }).jsonapi,
      { space: 2 }
    ),
    'cards/event-2/package.json': '{}',
  });

  let remote = await Remote.create(tempRepo.repo, 'origin', 'http://root:password@localhost:8838/git/repo');
  await remote.push('refs/heads/master', 'refs/heads/master', { force: true });
  return tempRepo;
}

describe('hub/git/writer with remote', function() {
  let env: TestEnv,
    repo: Repository,
    tempRepoDir: DirectoryResult,
    tempRemoteRepoDir: DirectoryResult,
    tempRemoteRepoPath: string,
    service: ScopedCardService,
    indexing: IndexingService,
    repoDoc: CardDocument,
    remoteRepo: Repository,
    head: string,
    csRealm: string;

  beforeEach(async function() {
    env = await createTestEnv();
    service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
    indexing = await env.container.lookup('indexing');
    let tempRepo = await resetRemote();
    head = tempRepo.head;
    remoteRepo = tempRepo.repo;

    tempRepoDir = await mkTmpDir({ unsafeCleanup: true });
    tempRemoteRepoDir = await mkTmpDir({ unsafeCleanup: true });
    process.env.REPO_ROOT_DIR = tempRepoDir.path;
    tempRemoteRepoPath = tempRemoteRepoDir.path;
    let remoteCacheDir = 'test-repo';

    repo = await Repository.clone('http://root:password@localhost:8838/git/repo', tempRemoteRepoPath);

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
    await rootDir.cleanup();
    await tempRepoDir.cleanup();
    await tempRemoteRepoDir.cleanup();
    await env.destroy();
    GitService.clearCache();
  });

  describe('create', function() {
    it('saves attributes', async function() {
      let cardDoc = cardDocument().withAutoAttributes({
        title: 'Second Article',
      });

      let cardInRepo = await service.create(repoRealm, cardDoc.jsonapi);

      await repo.fetchAll();
      let saved = await inRepo(tempRemoteRepoPath).getJSONContents(
        'origin/master',
        `cards/${cardInRepo.csId}/card.json`
      );
      expect(saved.data.attributes.title).to.equal('Second Article');
    });

    it('saves inner card file', async function() {
      let cardDoc = cardDocument().withAutoAttributes({
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      });

      let cardInRepo = await service.create(repoRealm, cardDoc.jsonapi);

      await repo.fetchAll();
      let innerCardFile = await inRepo(tempRemoteRepoPath).getContents(
        'origin/master',
        `cards/${cardInRepo.csId}/inner/example.hbs`
      );
      expect(innerCardFile).to.equal('Hello World');
    });
  });

  describe('update', function() {
    let savedDoc: CardDocument;
    let savedCard: AddressableCard;

    beforeEach(async function() {
      savedDoc = cardDocument().withAutoAttributes({
        title: 'Initial document',
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      });

      savedCard = await service.create(repoRealm, savedDoc.jsonapi);
    });

    it('can update a card', async function() {
      let updatedCard = await service.update(
        savedCard,
        savedCard.document.withAttributes({
          title: 'updated title',
        }).jsonapi
      );
      let head = updatedCard.meta?.version;
      expect(head).to.be.ok;

      await repo.fetchAll();
      let saved = await inRepo(tempRemoteRepoPath).getJSONContents(
        'origin/master',
        `cards/${savedCard.csId}/card.json`
      );
      expect(saved.data.attributes.title).to.equal('updated title');
    });

    it('successfully merges updates when repo is out of sync', async function() {
      await indexing.update();

      let change = await Change.create(remoteRepo, head, 'master');
      let file = await change.get('cards/event-2/card.json', { allowUpdate: true });
      file.setContent(
        stringify(
          cardDocument().withAutoAttributes({
            csId: 'event-2',
            title: 'This is a test event',
            'published-date': '2019-09-25',
          }).jsonapi,
          { space: 2 }
        )
      );
      await change.finalize({
        authorName: 'John Milton',
        authorEmail: 'john@paradiselost.com',
        message: 'I probably shouldnt update this out of sync',
      });

      let updatedCard = await service.update(
        { csRealm, csId: 'event-1' },
        {
          data: {
            type: 'cards',
            attributes: {
              title: 'Updated title',
            },
            meta: { version: head },
          },
        }
      );

      expect(await updatedCard.value('title')).to.equal('Updated title');
      expect(updatedCard.meta?.version).not.equal(head);

      await repo.fetchAll();
      let updated = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', 'cards/event-1/card.json');
      expect(updated).to.have.nested.property('data.attributes.title', 'Updated title');
      expect(updated).to.have.nested.property('data.attributes.publishedDate', '2018-09-25');
    });

    it('successfully merges updates when same file is out of sync', async function() {
      await indexing.update();

      let change = await Change.create(remoteRepo, head, 'master');
      let file = await change.get('cards/event-1/card.json', { allowUpdate: true });
      file.setContent(
        stringify(
          cardDocument().withAutoAttributes({
            csId: 'event-1',
            title: 'This is a test event',
            publishedDate: '2018-09-25',
          }).jsonapi,
          { space: 2 }
        )
      );
      await change.finalize({
        authorName: 'John Milton',
        authorEmail: 'john@paradiselost.com',
        message: 'I probably shouldnt update this out of sync',
      });

      let remote = await remoteRepo.getRemote('origin');
      await remote.push('refs/heads/master', 'refs/heads/master', { force: true });
      let updatedCard = await service.update(
        { csRealm, csId: 'event-1' },
        {
          data: {
            type: 'cards',
            attributes: {
              title: 'Updated title',
            },
            meta: {
              version: head,
            },
          },
        }
      );

      expect(await updatedCard.value('title')).to.equal('Updated title');
      expect(updatedCard.meta?.version).to.not.equal(head);

      await repo.fetchAll();

      let updated = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', 'cards/event-1/card.json');
      expect(updated).to.have.nested.property('data.attributes.title', 'Updated title');
      expect(updated).to.have.nested.property('data.attributes.publishedDate', '2018-09-25');
    });
  });

  describe('delete', function() {
    it('deletes document', async function() {
      await indexing.update();
      let docs = (await inRepo(tempRemoteRepoPath).listTree('origin/master', 'cards')).map(a => a.name);
      expect(docs).to.contain('event-1');

      await service.delete({ csRealm, csId: 'event-1' }, head);
      await repo.fetchAll();

      docs = (await inRepo(tempRemoteRepoPath).listTree('origin/master', 'cards')).map(a => a.name);
      expect(docs).to.not.contain('event-1');
    });
  });

  describe('git/writer with empty remote', function() {
    let env: TestEnv,
      repo: Repository,
      root: DirectoryResult,
      tempRepoDir: DirectoryResult,
      tempRemoteRepoDir: DirectoryResult,
      tempRemoteRepoPath: string,
      service: ScopedCardService,
      repoDoc: CardDocument,
      csRealm: string;

    beforeEach(async function() {
      env = await createTestEnv();
      service = await (await env.container.lookup('cards')).as(Session.EVERYONE);

      root = await mkTmpDir({ unsafeCleanup: true });
      let { repo: remoteRepo } = await makeRepo(root.path);
      let remote = await Remote.create(remoteRepo, 'origin', 'http://root:password@localhost:8838/git/repo');
      await remote.push('refs/heads/master', 'refs/heads/master', { force: true });

      tempRepoDir = await mkTmpDir({ unsafeCleanup: true });
      tempRemoteRepoDir = await mkTmpDir({ unsafeCleanup: true });
      process.env.REPO_ROOT_DIR = tempRepoDir.path;
      tempRemoteRepoPath = tempRemoteRepoDir.path;
      let remoteCacheDir = 'test-repo';

      repo = await Repository.clone('http://root:password@localhost:8838/git/repo', tempRemoteRepoPath);

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
      await root.cleanup();
      await tempRepoDir.cleanup();
      await tempRemoteRepoDir.cleanup();
      await env.destroy();
      GitService.clearCache();
    });

    describe('create', function() {
      it('allows you to create a record in an empty git repo', async function() {
        let card = await service.create(
          csRealm,
          cardDocument().withAutoAttributes({
            title: 'Fresh Event',
            publishedDate: '2018-09-01',
          }).jsonapi
        );

        await repo.fetchAll();
        let saved = await inRepo(tempRemoteRepoPath).getJSONContents('origin/master', `cards/${card.csId}/card.json`);
        expect(saved).to.have.nested.property('data.attributes.title', 'Fresh Event');
        expect(saved).to.have.nested.property('data.attributes.publishedDate', '2018-09-01');
      });
    });
  });

  describe('git/writer-remote/githereum', function() {
    it.skip('writes to githereum if configured when writing', async function() {});
  });
});
