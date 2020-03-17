import { TestEnv, createTestEnv } from '../helpers';
import IndexingService from '../../indexing';
import { cardDocument, CardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import CardsService, { ScopedCardService } from '../../cards-service';
import { Session } from '@cardstack/core/session';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import Change from '../../../../cards/git-realm/lib/change';
import { join } from 'path';
import { commitOpts, makeRepo, inRepo } from './support';
import { AddressableCard } from '@cardstack/core/card';

describe('hub/git/indexing', function() {
  let env: TestEnv, indexing: IndexingService, cards: CardsService, service: ScopedCardService;
  let repoRealm = `${myOrigin}/api/realms/test-git-repo`;
  let tmpDir: DirectoryResult;
  let root: string;
  let repoDoc: CardDocument;

  beforeEach(async function() {
    env = await createTestEnv();
    indexing = await env.container.lookup('indexing');
    cards = await env.container.lookup('cards');
    tmpDir = await mkTmpDir({ unsafeCleanup: true });
    process.env.REPO_ROOT_DIR = tmpDir.path;
    let repo = 'test-repo';
    root = join(tmpDir.path, repo);
    service = cards.as(Session.EVERYONE);

    repoDoc = cardDocument()
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'git-realm' })
      .withAttributes({ repo, csId: repoRealm });

    await service.create(`${myOrigin}/api/realms/meta`, repoDoc.jsonapi);
  });

  afterEach(async function() {
    await env.destroy();
  });

  it('processes first empty branch', async function() {
    let { head } = await makeRepo(root);

    await indexing.update();

    let indexerState = await indexing.loadMeta(repoRealm);
    expect(indexerState!.commit).to.equal(head);
  });

  it('indexes newly added document', async function() {
    let { repo, head } = await makeRepo(root);

    await indexing.update(); // we want the next indexing to be incremental

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('cards/hello-world/card.json', { allowCreate: true });
    file.setContent(
      JSON.stringify(
        cardDocument()
          .withField('title', 'string-field')
          .withAttributes({ csId: 'hello-world', title: 'hello world' }).jsonapi
      )
    );
    file = await change.get('cards/hello-world/package.json', { allowCreate: true });
    file.setContent('{}');
    head = await change.finalize(commitOpts());

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    let indexerState = await indexing.loadMeta(repoRealm);

    expect(indexerState!.commit).to.equal(head);

    let foundCard = await service.get({ csRealm: repoRealm, csId: 'hello-world' });

    expect(await foundCard.value('title')).to.equal('hello world');
  });

  it('indexes card with added inner file', async function() {
    let { repo } = await makeRepo(root);

    let card = await service.create(repoRealm, cardDocument().jsonapi);

    await indexing.update(); // we want the next indexing to be incremental

    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${card.csId}/inner/example.hbs`, { allowCreate: true });
    file.setContent('Hello World');
    head = await change.finalize(commitOpts());

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    let updatedCard = await service.get(card);
    expect(updatedCard.csFiles).to.deep.equal({
      inner: { 'example.hbs': 'Hello World' },
    });
  });

  it('indexes card with updated inner file', async function() {
    let { repo } = await makeRepo(root);

    let card = await service.create(
      repoRealm,
      cardDocument().withAttributes({
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      }).jsonapi
    );

    await indexing.update(); // we want the next indexing to be incremental

    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${card.csId}/inner/example.hbs`, { allowUpdate: true });
    file.setContent('Hello Mars');
    head = await change.finalize(commitOpts());

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    let updatedCard = await service.get(card);
    expect(updatedCard.csFiles).to.deep.equal({
      inner: { 'example.hbs': 'Hello Mars' },
    });
  });

  it('indexes card with removed inner file', async function() {
    let { repo } = await makeRepo(root);

    let card = await service.create(
      repoRealm,
      cardDocument().withAttributes({
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      }).jsonapi
    );

    await indexing.update(); // we want the next indexing to be incremental

    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${card.csId}/inner/example.hbs`);
    file.delete();
    head = await change.finalize(commitOpts());

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    let updatedCard = await service.get(card);
    expect(updatedCard.csFiles).to.deep.equal({});
  });

  it('removes a card that is no longer in git', async function() {
    let { repo } = await makeRepo(root);

    let card = await service.create(repoRealm, cardDocument().jsonapi);
    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');

    await indexing.update(); // we want the next indexing to be incremental

    // right now cards without inner files only have 2 files: card.json and package.json
    let file = await change.get(`cards/${card.csId}/card.json`);
    file.delete();
    file = await change.get(`cards/${card.csId}/package.json`);
    file.delete();
    head = await change.finalize(commitOpts());

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count + 1, 'wrong number of operations');

    try {
      await service.get(card);
      throw new Error(`Should not be able to get the card`);
    } catch (e) {
      expect(e).hasStatus(404);
    }
  });

  it('indexes a url-encoded id card', async function() {
    let { repo, head } = await makeRepo(root);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('cards/foo%2Fbar%2Fbaz/card.json', { allowCreate: true });
    file.setContent(
      JSON.stringify(
        cardDocument()
          .withField('title', 'string-field')
          .withAttributes({ csId: 'foo/bar/baz', title: 'hello world' }).jsonapi
      )
    );
    file = await change.get('cards/foo%2Fbar%2Fbaz/package.json', { allowCreate: true });
    file.setContent('{}');
    head = await change.finalize(commitOpts());

    await indexing.update();

    let indexerState = await indexing.loadMeta(repoRealm);

    expect(indexerState!.commit).to.equal(head);

    let foundCard = await service.get({ csRealm: repoRealm, csId: 'foo/bar/baz' });

    expect(await foundCard.value('title')).to.equal('hello world');
  });

  it('indexes cards in dependency order', async function() {
    let { repo, head } = await makeRepo(root);
    let author = cardDocument().withAutoAttributes({
      csId: 'mango',
      csRealm: repoRealm,
      name: 'Mango',
    });
    let article = cardDocument()
      .withAutoAttributes({
        csId: 'article',
        csRealm: repoRealm,
        title: 'Things I Chew',
        body: 'Literally everything.',
      })
      .withAutoRelationships({ author });

    let change = await Change.create(repo, head, 'master');
    // because this card's directory "article" is alphabetically before the card
    // it depends on, "mango", the natural tendency is that it will be indexed
    // first--it looks like the isomorphic git's Tree API gets entries in
    // alphabetical order.
    let file = await change.get('cards/article/card.json', { allowCreate: true });
    file.setContent(JSON.stringify(article.jsonapi));
    file = await change.get('cards/article/package.json', { allowCreate: true });
    file.setContent('{}');

    file = await change.get('cards/mango/card.json', { allowCreate: true });
    file.setContent(JSON.stringify(author.jsonapi));
    file = await change.get('cards/mango/package.json', { allowCreate: true });
    file.setContent('{}');

    head = await change.finalize(commitOpts());
    await indexing.update();

    let card = await service.get(article);
    expect(((await card.value('author')) as AddressableCard).canonicalURL).to.equal(author.canonicalURL);
  });

  it('does not index unchanged card', async function() {
    await makeRepo(root);

    await service.create(repoRealm, cardDocument().jsonapi);

    await indexing.update(); // we want the next indexing to be incremental

    let count = indexing.operationsCount;
    await indexing.update();
    expect(indexing.operationsCount).to.equal(count, 'wrong number of operations');
  });
});
