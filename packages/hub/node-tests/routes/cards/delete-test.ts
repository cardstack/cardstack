import { join } from 'path';
import { encodeCardURL } from '@cardstack/core/src/utils';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { existsSync } from 'fs-extra';
import { expect } from 'chai';
import { configureHubWithCompiler } from '../../helpers/cards';

if (process.env.COMPILER) {
  describe('DELETE /cards/<card-id>', function () {
    function getCard(cardURL: string) {
      return request().get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    function deleteCard(cardURL: string) {
      return request().del(`/cards/${encodeURIComponent(cardURL)}`);
    }

    let { realmURL, getFileCache, request, cards, getRealmDir } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Post {
              @contains(string) title;
              @contains(string) body;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post0',
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
        },
      });
    });

    it('returns a 404 when trying to delete from a card that doesnt exist', async function () {
      await deleteCard(`${realmURL}car0`).expect(404);
    });

    it('can delete an existing card that has no children', async function () {
      await getCard(`${realmURL}post0`).expect(200);

      await deleteCard(`${realmURL}post0`).expect(204);
      await getCard(`${realmURL}post0`).expect(404);

      expect(
        existsSync(join(getFileCache().dir, 'node', encodeCardURL(`${realmURL}post0`))),
        'Cache for card is deleted'
      ).to.be.false;

      expect(existsSync(join(getRealmDir(), 'post0')), 'card is deleted from realm').to.be.false;
    });

    it('can delete an existing card that has children', async function () {
      await getCard(`${realmURL}post`).expect(200);
      await deleteCard(`${realmURL}post`).expect(204);
      await getCard(`${realmURL}post`).expect(404); // Deleted card is deleted!
      await getCard(`${realmURL}post0`).expect(422); // card is in an error state

      expect(
        existsSync(join(getFileCache().dir, 'node', encodeCardURL(`${realmURL}post`))),
        'Cache for card is deleted'
      ).to.be.false;

      expect(existsSync(join(getRealmDir(), 'post')), 'card is deleted from realm').to.be.false;
    });
  });
}
