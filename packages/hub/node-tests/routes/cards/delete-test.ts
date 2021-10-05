import { join } from 'path';
import { encodeCardURL } from '@cardstack/core/src/utils';
import supertest from 'supertest';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { existsSync } from 'fs-extra';
import { expect } from 'chai';
import { ProjectTestRealm, setupCardServer } from '../../helpers/cards';

if (process.env.COMPILER) {
  describe('DELETE /cards/<card-id>', function () {
    let realm: ProjectTestRealm;

    function getCard(cardURL: string) {
      return supertest(getServer().app.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    function deleteCard(cardURL: string) {
      return supertest(getServer().app.callback()).del(`/cards/${encodeURIComponent(cardURL)}`);
    }

    let { createRealm, getCardCache, getServer } = setupCardServer(this);

    this.beforeEach(async function () {
      realm = createRealm('https://my-realm');
      realm.addCard('post', {
        'card.json': {
          schema: 'schema.js',
          isolated: 'isolated.js',
        },
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        export default class Post {
          @contains(string)
          title;
          @contains(string)
          body;
        }
      `,
        'isolated.js': templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
      });

      realm.addCard('post0', {
        'card.json': {
          adoptsFrom: '../post',
          data: {
            title: 'Hello World',
            body: 'First post.',
          },
        },
      });
    });

    it('returns a 404 when trying to delete from a card that doesnt exist', async function () {
      await deleteCard('https://my-realm/car0').expect(404);
    });

    it('can delete an existing card that has no children', async function () {
      await getCard('https://my-realm/post0').expect(200);

      await deleteCard('https://my-realm/post0').expect(204);
      await getCard('https://my-realm/post0').expect(404);

      expect(
        existsSync(join(getCardCache().dir, 'node', encodeCardURL('https://my-realm/post0'))),
        'Cache for card is deleted'
      ).to.be.false;

      expect(existsSync(join(realm.directory, 'post0')), 'card is deleted from realm').to.be.false;
    });
  });
}
