import { join } from 'path';
import { encodeCardURL } from '@cardstack/core/src/utils';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { existsSync } from 'fs-extra';
import { expect } from 'chai';
import { setupHub } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('DELETE /cards/<card-id>', function () {
    function getCard(cardURL: string) {
      return request().get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    function deleteCard(cardURL: string) {
      return request().del(`/cards/${encodeURIComponent(cardURL)}`);
    }

    let { getContainer, cards, getCardCache, request, realm } = setupHub(this);

    this.beforeEach(async function () {
      await cards.create({
        url: `${realm}post`,
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
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
        },
      });

      await cards.create({
        url: `${realm}post0`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
        },
      });
    });

    it('returns a 404 when trying to delete from a card that doesnt exist', async function () {
      await deleteCard(`${realm}car0`).expect(404);
    });

    it('can delete an existing card that has no children', async function () {
      await getCard(`${realm}post0`).expect(200);

      await deleteCard(`${realm}post0`).expect(204);
      await getCard(`${realm}post0`).expect(404);

      expect(existsSync(join(getCardCache().dir, 'node', encodeCardURL(`${realm}post0`))), 'Cache for card is deleted')
        .to.be.false;

      // TODO: Can we make getRealm return the corrent realm type?
      let fsrealm = (await getContainer().lookup('realm-manager')).getRealm(realm) as any;
      expect(existsSync(join(fsrealm.directory, 'post0')), 'card is deleted from realm').to.be.false;
    });
  });
}
