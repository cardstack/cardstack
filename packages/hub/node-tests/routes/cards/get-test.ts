import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { ProjectTestRealm } from '../../helpers/cards';
import { setupServer } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('GET /cards/<card-id>', function () {
    let realm: ProjectTestRealm;

    function getCard(cardURL: string) {
      return request().get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    let { createRealm, resolveCard, request } = setupServer(this);

    this.beforeEach(async function () {
      realm = await createRealm('https://my-realm');

      realm.addCard('pet', {
        'card.json': {
          schema: 'schema.js',
        },
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        export default class Pet {
          @contains(string) species;
        }
        `,
      });

      realm.addCard('person', {
        'card.json': {
          schema: 'schema.js',
        },
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        import pet from "https://my-realm/pet";
        export default class Person {
          @contains(string) name;
          @contains(pet) bestFriend;
        }
        `,
      });

      realm.addCard('post', {
        'card.json': {
          schema: 'schema.js',
          isolated: 'isolated.js',
        },
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        import datetime from "https://cardstack.com/base/datetime";
        import person from 'https://my-realm/person';
        export default class Post {
          @contains(string) title;
          @contains(string) body;
          @contains(datetime) createdAt;
          @contains(string) extra;
          @contains(person) author;
        }
      `,
        'isolated.js': templateOnlyComponentTemplate(
          '<h1><@fields.title/></h1><article><@fields.body/><@fields.author.name/><@fields.author.bestFriend.species/>/</article>'
        ),
      });

      realm.addCard('post0', {
        'card.json': {
          adoptsFrom: '../post',
          data: {
            title: 'Hello World',
            body: 'First post.',
            author: {
              name: 'Emily',
              bestFriend: {
                species: 'dog',
              },
            },
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
        author: {
          name: 'Emily',
          bestFriend: {
            species: 'dog',
          },
        },
      });
      expect(response.body.data?.meta.componentModule).to.not.be.undefined;

      let componentModule = response.body.data?.meta.componentModule;
      expect(componentModule, 'should have componentModule').to.not.be.undefined;
      expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });
  });
}
