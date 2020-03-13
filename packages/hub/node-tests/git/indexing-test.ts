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

    await indexing.update();

    let indexerState = await indexing.loadMeta(repoRealm);

    expect(indexerState!.commit).to.equal(head);

    let foundCard = await service.get({ csRealm: repoRealm, csId: 'hello-world' });

    expect(await foundCard.value('title')).to.equal('hello world');
  });

  it('indexes card with added inner file', async function() {
    let { repo } = await makeRepo(root);

    let card = await service.create(repoRealm, cardDocument().jsonapi);

    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${card.csId}/inner/example.hbs`, { allowCreate: true });
    file.setContent('Hello World');
    head = await change.finalize(commitOpts());

    await indexing.update();

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

    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${card.csId}/inner/example.hbs`, { allowUpdate: true });
    file.setContent('Hello Mars');
    head = await change.finalize(commitOpts());

    await indexing.update();

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

    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${card.csId}/inner/example.hbs`);
    file.delete();
    head = await change.finalize(commitOpts());

    await indexing.update();

    let updatedCard = await service.get(card);
    expect(updatedCard.csFiles).to.deep.equal({});
  });

  it('removes a card that is no longer in git', async function() {
    let { repo } = await makeRepo(root);

    let card = await service.create(repoRealm, cardDocument().jsonapi);
    let head = (await inRepo(root).getCommit('master')).id;
    let change = await Change.create(repo, head, 'master');

    // right now cards without inner files only have 2 files: card.json and package.json
    let file = await change.get(`cards/${card.csId}/card.json`);
    file.delete();
    file = await change.get(`cards/${card.csId}/package.json`);
    file.delete();
    head = await change.finalize(commitOpts());

    await indexing.update();

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

  // it('it can index a realm', async function() {
  //   let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
  //   let card = cardDocument().withAutoAttributes({ csRealm, csId: '1', foo: 'bar' });
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm);

  //   await indexing.update();

  //   let indexedCard = await cards.as(Session.INTERNAL_PRIVILEGED).get(card);
  //   expect(indexedCard).to.be.ok;
  // });

  // it('it can remove a document from the index if the document was removed from the data source', async function() {
  //   let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
  //   let card = await cards
  //     .as(Session.INTERNAL_PRIVILEGED)
  //     .create(csRealm, cardDocument().withAutoAttributes({ csRealm, csId: '1', foo: 'bar' }).jsonapi);
  //   storage.store(null, card.csId, card.csRealm, storage.getEntry(card, csRealm)?.generation);
  //   await indexing.update();

  //   let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
  //     filter: { eq: { csId: '1' } },
  //   });
  //   expect(results.length).to.equal(0);
  // });

  // it('it can index multiple realms', async function() {
  //   let realm1 = `${myOrigin}/api/realms/first-ephemeral-realm`;
  //   let realm2 = `http://example.com/api/realms/second-ephemeral-realm`;
  //   let card = cardDocument().withAutoAttributes({ csRealm: realm1, csId: '1', foo: 'bar' });
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm);
  //   card = cardDocument().withAutoAttributes({ csRealm: realm2, csId: '1', foo: 'bar' });
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm);

  //   await indexing.update();

  //   let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
  //     filter: { eq: { csId: '1' } },
  //   });
  //   expect(results.length).to.equal(2);
  // });

  // it('ephemeral cards do not persist in the index between container teardowns', async function() {
  //   let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;

  //   // card is indexed in torn down ephemeral storage
  //   // This card will _not_ live through the container teardown
  //   let card = cardDocument().withAutoAttributes({ csRealm: realm, csId: '1', foo: 'bar' });
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm);
  //   await indexing.update();

  //   // card is not yet indexed in torn down ephemeral storage
  //   // This card will _not_ live through the container teardown
  //   card = cardDocument().withAutoAttributes({ csRealm: realm, csId: '2', foo: 'bar' });
  //   storage.store(await card.upstreamDoc, card.csId, card.csRealm);
  //   await env.container.teardown();
  //   env.container = await wireItUp();

  //   cards = await env.container.lookup('cards');
  //   indexing = await env.container.lookup('indexing');
  //   storage = await env.container.lookup('ephemeralStorage');
  //   (await env.container.lookup('queue')).launchJobRunner();

  //   // card is not yet indexed in new ephemeral storage
  //   // This card _will_ live through the container teardown
  //   card = cardDocument().withAutoAttributes({ csRealm: realm, csId: '3', foo: 'bar' });
  //   storage.store(await card.upstreamDoc, card.csId, card.csRealm);
  //   await indexing.update();

  //   let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
  //     filter: { eq: { csId: '1' } },
  //   });
  //   expect(results.length).to.equal(0);

  //   ({ cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
  //     filter: { eq: { csId: '2' } },
  //   }));
  //   expect(results.length).to.equal(0);

  //   ({ cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
  //     filter: { eq: { csId: '3' } },
  //   }));
  //   expect(results.length).to.equal(1);
  // });

  // it('it does not index unchanged cards since the last time the ephemeral realm was indexed', async function() {
  //   let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;

  //   let steps = await cards.as(Session.INTERNAL_PRIVILEGED).create(
  //     realm,
  //     cardDocument()
  //       .withField('foo', 'string-field')
  //       .withField('step', 'integer-field').jsonapi
  //   );

  //   async function cardsWithStep(n: number): Promise<number> {
  //     let found = await cards.as(Session.INTERNAL_PRIVILEGED).search({
  //       filter: {
  //         type: steps,
  //         eq: {
  //           step: n,
  //         },
  //       },
  //     });
  //     return found.cards.length;
  //   }

  //   // Add a new card
  //   let card = cardDocument()
  //     .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 1 })
  //     .adoptingFrom(steps);
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm);
  //   await indexing.update();
  //   expect(await cardsWithStep(1)).to.equal(1);

  //   // Add another new card
  //   card = cardDocument()
  //     .withAttributes({ csRealm: realm, csId: '2', foo: 'bar', step: 2 })
  //     .adoptingFrom(steps);
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm);

  //   // Maniuplate existing card so we would notice if it gets indexed when it shouldn't.
  //   await storage.inThePast(async () => {
  //     card = cardDocument()
  //       .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 2 })
  //       .adoptingFrom(steps);
  //     storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('1', realm)?.generation);
  //   });

  //   await indexing.update();
  //   let n = await cardsWithStep(2);
  //   expect(n).to.equal(1);

  //   // Update first card
  //   card = cardDocument()
  //     .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 3 })
  //     .adoptingFrom(steps);
  //   storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('1', realm)?.generation);

  //   // Maniuplate other existing card so we would notice if it gets indexed when it shouldn't.
  //   await storage.inThePast(async () => {
  //     card = cardDocument()
  //       .withAttributes({ csRealm: realm, csId: '2', foo: 'bar', step: 3 })
  //       .adoptingFrom(steps);
  //     storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('2', realm)?.generation);
  //   });

  //   await indexing.update();
  //   expect(await cardsWithStep(3)).to.equal(1);

  //   // Delete card 2
  //   storage.store(null, card.csId, card.csRealm, storage.getEntry('2', realm)?.generation);

  //   // Maniuplate other existing card so we would notice if it gets indexed when it shouldn't.
  //   await storage.inThePast(async () => {
  //     card = cardDocument()
  //       .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 4 })
  //       .adoptingFrom(steps);
  //     storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('1', realm)?.generation);
  //   });

  //   await indexing.update();
  //   expect(await cardsWithStep(4)).to.equal(0);

  //   // stable case
  //   await indexing.update();
  //   expect(await cardsWithStep(4)).to.equal(0);
  // });
});
