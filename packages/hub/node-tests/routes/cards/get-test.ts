import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { cardHelpers, configureCompiler } from '../../helpers/cards';
import { setupHub } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('GET /cards/<card-id>', function () {
    function getCard(cardURL: string) {
      return request().get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    let { realmURL } = configureCompiler(this);
    let { request } = setupHub(this);
    let { cards, resolveCard } = cardHelpers(this);

    this.beforeEach(async function () {
      await cards.create({
        url: `${realmURL}pet`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Pet {
              @contains(string) species;
            }
          `,
        },
      });

      await cards.create({
        url: `${realmURL}person`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import pet from "${realmURL}pet";
            export default class Person {
              @contains(string) name;
              @contains(pet) bestFriend;
            }
          `,
        },
      });

      await cards.create({
        url: `${realmURL}post`,
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import datetime from "https://cardstack.com/base/datetime";
            import person from '${realmURL}person';
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
        },
      });

      await cards.create({
        url: `${realmURL}post0`,
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
      });
    });

    it("404s when you try to load a card outside of it's realm", async function () {
      // assert.expect(0);
      await getCard('https://some-other-origin.com/thing').expect(404);
    });

    it("can load a simple isolated card's data", async function () {
      let response = await getCard(`${realmURL}post0`); // .expect(200);
      // console.log(JSON.stringify(response.body, null, 2));

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.have.keys('type', 'id', 'meta', 'relationships', 'attributes');
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
