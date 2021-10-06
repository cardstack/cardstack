import supertest from 'supertest';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { ProjectTestRealm } from '../../helpers/cards';
import { setupServer } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('GET /cards/<card-id>', function () {
    let realm: ProjectTestRealm;

    function getCard(cardURL: string) {
      return supertest(getServer().app.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    let { createRealm, resolveCard, getServer } = setupServer(this);

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
        import datetime from "https://cardstack.com/base/datetime";
        export default class Post {
          @contains(string) title;
          @contains(string) body;
          @contains(datetime) createdAt;
          @contains(string) extra;
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

    it("404s when you try to load a card outside of it's realm", async function () {
      // assert.expect(0);
      await getCard('https://some-other-origin.com/thing').expect(404);
    });

    it("can load a simple isolated card's data", async function () {
      let response = await getCard('https://my-realm/post0').expect(200);

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.have.all.keys('type', 'id', 'meta', 'attributes');
      expect(response.body.data?.attributes).to.deep.equal({
        title: 'Hello World',
        body: 'First post.',
      });
      expect(response.body.data?.meta.componentModule).to.not.be.undefined;

      let componentModule = response.body.data?.meta.componentModule;
      expect(componentModule, 'should have componentModule').to.not.be.undefined;
      expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });
  });
}
