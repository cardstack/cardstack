import { ScopedCardService } from '../../cards-service';
import { myOrigin } from '../../origin';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { AddressableCard } from '../../card';
import { Session } from '@cardstack/core/session';
import { createTestEnv, TestEnv } from '../helpers';
import { cardDocument, CardDocument } from '@cardstack/core/card-document';
import { makeRepo, inRepo } from './support';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import { join } from 'path';

describe('hub/git/writer', function() {
  this.timeout(10000);
  let env: TestEnv;
  let service: ScopedCardService;
  let repoRealm = `${myOrigin}/api/realms/test-git-repo`;
  let repoDoc;
  let repoPath: string;
  let tmpDir: DirectoryResult;

  beforeEach(async function() {
    env = await createTestEnv();
    service = await (await env.container.lookup('cards')).as(Session.EVERYONE);

    tmpDir = await mkTmpDir({ unsafeCleanup: true });
    process.env.REPO_ROOT_DIR = tmpDir.path;
    let repo = 'test-repo';
    repoPath = join(tmpDir.path, repo);

    await makeRepo(repoPath);

    repoDoc = cardDocument()
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'git-realm' })
      .withAttributes({ repo, csId: repoRealm });

    await service.create(`${myOrigin}/api/realms/meta`, repoDoc.jsonapi);
  });

  afterEach(async function() {
    await env.destroy();
    await tmpDir.cleanup();
  });

  describe('create', function() {
    it('can get a card back out', async function() {
      let cardDoc = cardDocument();
      let cardInRepo = await service.create(repoRealm, cardDoc.jsonapi);

      let foundCard = await service.get(cardInRepo);
      expect(foundCard.canonicalURL).equals(cardInRepo.canonicalURL);
    });

    it('saves attributes', async function() {
      let cardDoc = cardDocument().withAutoAttributes({
        title: 'Second Article',
      });

      let cardInRepo = await service.create(repoRealm, cardDoc.jsonapi);

      let saved = await inRepo(repoPath).getJSONContents('master', `cards/${cardInRepo.csId}/card.json`);
      expect(saved.data.attributes.title).to.equal('Second Article');
    });

    it('saves cards with an id', async function() {
      let cardDoc = cardDocument()
        .withAutoAttributes({
          title: 'Second Article',
        })
        .withAttributes({ csId: 'custom-id' });

      await service.create(repoRealm, cardDoc.jsonapi);

      let saved = await inRepo(repoPath).getJSONContents('master', `cards/custom-id/card.json`);
      expect(saved.data.attributes.title).to.equal('Second Article');
    });

    it('does not write csRealm to serialized card.json in git', async function() {
      let cardDoc = cardDocument()
        .withAutoAttributes({
          title: 'Second Article',
        })
        .withAttributes({ csId: 'custom-id' });

      await service.create(repoRealm, cardDoc.jsonapi);

      let saved = await inRepo(repoPath).getJSONContents('master', `cards/custom-id/card.json`);
      expect(saved.data.attributes.csRealm).to.be.undefined;
    });

    it('saves inner card files', async function() {
      let cardDoc = cardDocument()
        .withAutoAttributes({
          title: 'Second Article',
        })
        .withAttributes({
          csId: 'custom-id',
          csFiles: { inner: { 'example.hbs': 'Hello World' } },
        });

      let card = await service.create(repoRealm, cardDoc.jsonapi);
      expect(card.csFiles).to.deep.equal({
        inner: { 'example.hbs': 'Hello World' },
      });

      let innerCardFile = await inRepo(repoPath).getContents('master', `cards/custom-id/inner/example.hbs`);
      expect(innerCardFile).to.equal('Hello World');
    });

    it('url encodes id', async function() {
      let cardDoc = cardDocument()
        .withAutoAttributes({
          title: 'Second Article',
        })
        .withAttributes({ csId: 'foo/bar/baz' });

      await service.create(repoRealm, cardDoc.jsonapi);
      let saved = await inRepo(repoPath).getJSONContents('master', `cards/foo%2Fbar%2Fbaz/card.json`);
      expect(saved.data.attributes.title).to.equal('Second Article');
    });

    it('rejects conflicting clientside id', async function() {
      let cardDoc = cardDocument().withAttributes({ csId: 'test' });
      await service.create(repoRealm, cardDoc.jsonapi);

      try {
        await service.create(repoRealm, cardDoc.jsonapi);
        throw new Error('should not be able to create a card');
      } catch (err) {
        expect(err).hasStatus(409);
        expect(err.detail).to.equal('The cardDir cards/test is already in use');
      }
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
      let version = savedCard.meta?.version;
      expect(version).to.be.ok;

      let jsonapi = savedCard.document.jsonapi;
      jsonapi.data.attributes!.title = 'Updated document';
      savedCard = await service.update(savedCard, jsonapi);
      let newVersion = savedCard.meta?.version;

      expect(await savedCard.value('title')).to.equal('Updated document');
      expect(newVersion).to.be.ok;
      expect(newVersion).to.not.equal(version);

      let saved = await inRepo(repoPath).getJSONContents('master', `cards/${savedCard.csId}/card.json`);
      expect(saved.data.attributes.title).to.equal('Updated document');
      expect(saved.data.attributes.csRealm).to.be.undefined;
    });

    it("can update a card's inner files", async function() {
      let version = savedCard.meta?.version;
      expect(version).to.be.ok;

      let jsonapi = savedCard.document.jsonapi;
      jsonapi.data.attributes!.csFiles = {
        inner: { 'example.hbs': 'Hello Mars' },
      };
      savedCard = await service.update(savedCard, jsonapi);

      expect(savedCard.csFiles).to.deep.equal({
        inner: { 'example.hbs': 'Hello Mars' },
      });
      let innerCardFile = await inRepo(repoPath).getContents('master', `cards/${savedCard.csId}/inner/example.hbs`);
      expect(innerCardFile).to.equal('Hello Mars');
    });

    it('can add a new card inner file', async function() {
      let version = savedCard.meta?.version;
      expect(version).to.be.ok;

      let jsonapi = savedCard.document.jsonapi;
      jsonapi.data.attributes!.csFiles = {
        'example.css': 'literally the best style',
        inner: { 'example.hbs': 'Hello World' },
      };

      savedCard = await service.update(savedCard, jsonapi);

      expect(savedCard.csFiles).to.deep.equal({
        'example.css': 'literally the best style',
        inner: { 'example.hbs': 'Hello World' },
      });

      let innerCardFile = await inRepo(repoPath).getContents('master', `cards/${savedCard.csId}/inner/example.hbs`);
      expect(innerCardFile).to.equal('Hello World');
      innerCardFile = await inRepo(repoPath).getContents('master', `cards/${savedCard.csId}/example.css`);
      expect(innerCardFile).to.equal('literally the best style');
    });

    it("can remove a card's inner file", async function() {
      let version = savedCard.meta?.version;
      expect(version).to.be.ok;

      let jsonapi = savedCard.document.jsonapi;
      jsonapi.data.attributes!.csFiles = {};
      savedCard = await service.update(savedCard, jsonapi);

      expect(savedCard.csFiles).to.deep.equal({});

      let saved = await inRepo(repoPath).getJSONContents('master', `cards/${savedCard.csId}/card.json`);
      expect(saved.data.attributes.title).to.equal('Initial document');
      let repoContents = (await inRepo(repoPath).listTree('master', `cards/${savedCard.csId}`)).map(a => a.name);
      expect(repoContents).not.to.include(`inner`);
    });

    it('reports merge conflict', async function() {
      await service.update(savedCard, savedCard.document.withAttributes({ title: 'updated title' }).jsonapi);
      try {
        await service.update(savedCard, {
          data: {
            type: 'cards',
            attributes: {
              title: 'another update',
            },
            meta: {
              version: savedCard.meta!.version, // this is no longer the head sha
            },
          },
        });
        throw new Error(`should not be able to update the card`);
      } catch (err) {
        expect(err).hasStatus(409);
        expect(err.detail).to.match(/merge conflict/i);
      }
    });
  });

  describe('delete', function() {
    let savedDoc: CardDocument;
    let savedCard: AddressableCard;

    beforeEach(async function() {
      let otherDoc = cardDocument();
      await service.create(repoRealm, otherDoc.jsonapi);

      savedDoc = cardDocument().withAutoAttributes({
        title: 'Initial document',
      });

      savedCard = await service.create(repoRealm, savedDoc.jsonapi);
    });

    it('can delete a card', async function() {
      let version = savedCard.meta?.version as string;

      let repoContents = (await inRepo(repoPath).listTree('master', `cards/${savedCard.csId}`)).map(a => a.name);
      expect(repoContents).to.include(`card.json`);
      await service.delete(savedCard, version);

      repoContents = (await inRepo(repoPath).listTree('master', 'cards')).map(a => a.name);
      expect(repoContents).not.to.include(`${savedCard.csId}`);
    });

    it('requires version', async function() {
      try {
        await service.delete(savedCard);
        throw new Error('should not be able to delete card');
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.equal('version is required');
      }
    });

    it('reports merge conflict', async function() {
      await service.update(savedCard, savedCard.document.withAttributes({ title: 'updated title' }).jsonapi);
      try {
        await service.delete(savedCard, savedCard.meta!.version as string); // version is no longer the head sha
        throw new Error('should not be able to delete card');
      } catch (err) {
        expect(err).hasStatus(409);
        expect(err.detail).to.match(/merge conflict/i);
      }
    });
  });
});
