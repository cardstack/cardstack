import { ScopedCardService } from '../../cards-service';
import { myOrigin } from '../../origin';
import { CARDSTACK_PUBLIC_REALM } from '../../realm';
import { Session } from '../../session';
import { createTestEnv, TestEnv } from '../helpers';
import { cardDocument } from '../../card-document';
import { makeRepo } from './support';
import { join } from 'path';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';

describe('hub/git/card-service', function() {
  describe('read-write', function() {
    let env: TestEnv;
    let service: ScopedCardService;
    let repoRealm = `${myOrigin}/api/realms/test-git-repo`;
    let repoDoc;
    let repoPath;
    let tmpDir: DirectoryResult;

    beforeEach(async function() {
      env = await createTestEnv();
      service = await (await env.container.lookup('cards')).as(Session.EVERYONE);

      tmpDir = await mkTmpDir({ unsafeCleanup: true });
      process.env.REPO_ROOT_DIR = tmpDir.path;
      repoPath = 'test-repo';

      await makeRepo(join(tmpDir.path, repoPath));

      repoDoc = cardDocument()
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'git-realm' })
        .withAttributes({ repo: repoPath, csId: repoRealm });

      await service.create(`${myOrigin}/api/realms/meta`, repoDoc.jsonapi);
    });

    afterEach(async function() {
      await env.destroy();
      await tmpDir.cleanup();
    });

    it('can get a card back out', async function() {
      let cardDoc = cardDocument();
      let cardInRepo = await service.create(repoRealm, cardDoc.jsonapi);

      let foundCard = await service.get(cardInRepo);
      expect(foundCard.canonicalURL).equals(cardInRepo.canonicalURL);
    });

    it('can get a card out by canonical URL', async function() {
      let doc = cardDocument();
      let card = await service.create(repoRealm, doc.jsonapi);
      let foundCard = await service.get(card.canonicalURL);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
    });

    it('can create a card that adopts from another', async function() {
      let parentCard = await service.create(repoRealm, cardDocument().jsonapi);

      let doc = cardDocument()
        .withAutoAttributes({ goodbye: 'world' })
        .adoptingFrom(parentCard);
      let card = await service.create(repoRealm, doc.jsonapi);
      let parent = await card.adoptsFrom();
      expect(parent?.canonicalURL).to.equal(parentCard.canonicalURL);
    });

    it('can update a card', async function() {
      let card = await service.create(repoRealm, cardDocument().jsonapi);

      card = await service.update(card, card.document.withAttributes({ csTitle: 'Hello World' }).jsonapi);
      expect(card.csTitle).to.equal('Hello World');

      card = await service.get(card);
      expect(card.csTitle).to.equal('Hello World');
    });

    it('can delete a card', async function() {
      let card = await service.create(repoRealm, cardDocument().jsonapi);
      card = await service.get(card);
      expect(card).to.be.ok;

      await service.delete(card, card.meta!.version as string);

      try {
        await service.get(card);
        throw new Error('should not be able to get a card');
      } catch (err) {
        expect(err).hasStatus(404);
      }
    });
  });
});
