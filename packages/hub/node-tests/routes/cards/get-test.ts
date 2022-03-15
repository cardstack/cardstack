import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { configureHubWithCompiler } from '../../helpers/cards';

if (process.env.COMPILER) {
  describe('GET /cards/<card-id>', function () {
    function getCard(cardURL: string, allFields = false) {
      return request().get(`/cards/${encodeURIComponent(cardURL)}${allFields ? '?allFields' : ''}`);
    }

    let { realmURL, request, cards, resolveCard } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create({
        realm: realmURL,
        id: 'pet',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Pet {
              @contains(string) species;
              @contains(string) name;

              @contains(string)
              get description() {
                return this.name + " the " + this.species;
              }
            }
          `,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import pet from "${realmURL}pet";
            export default class Person {
              @contains(string) name;
              @contains(pet) bestFriend;

              @contains(string)
              get summary() {
                return this.name + "'s best friend is " + this.bestFriend.description;
              }

              @contains(string)
              get about() {
                return "Author " + this.name + " lives with their best friend, " + this.bestFriend.description;
              }
            }
          `,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import integer from "https://cardstack.com/base/integer";
            import datetime from "https://cardstack.com/base/datetime";
            import person from '${realmURL}person';
            export default class Post {
              @contains(string) title;
              @contains(string) body;
              @contains(datetime) createdAt;
              @contains(string) extra;
              @contains(person) author;
              @contains(string) favoriteColor;
              @contains(integer) rating;
              @contains(string)
              get ratingPct() {
                return this.rating / 5 * 100 + '%';
              }
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@fields.title/></h1><article><@fields.body/><@fields.author.name/><@fields.author.bestFriend.species/><@fields.author.summary/><@fields.ratingPct/></article>'
          ),
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post0',
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
          favoriteColor: 'blue',
          rating: 3,
          author: {
            name: 'Emily',
            bestFriend: {
              species: 'dog',
              name: 'Max',
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
      let response = await getCard(`${realmURL}post0`);
      expect(response).to.hasStatus(200);

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.have.keys('type', 'id', 'meta', 'attributes');
      expect(response.body.data?.attributes).to.deep.equal({
        title: 'Hello World',
        body: 'First post.',
        ratingPct: '60%',
        author: {
          name: 'Emily',
          bestFriend: {
            species: 'dog',
          },
          summary: "Emily's best friend is Max the dog",
        },
      });
      expect(response.body.data?.meta.componentModule).to.not.be.undefined;

      let componentModule = response.body.data?.meta.componentModule;
      expect(componentModule, 'should have componentModule').to.not.be.undefined;
      expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });

    it('can load all the fields for a card', async function () {
      let response = await getCard(`${realmURL}post0`, true);
      expect(response).to.hasStatus(200);

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.have.keys('type', 'id', 'meta', 'attributes');
      expect(response.body.data?.attributes).to.deep.equal({
        title: 'Hello World',
        body: 'First post.',
        favoriteColor: 'blue',
        createdAt: null,
        extra: null,
        rating: 3,
        ratingPct: '60%',
        author: {
          about: 'Author Emily lives with their best friend, Max the dog',
          bestFriend: {
            description: 'Max the dog',
            name: 'Max',
            species: 'dog',
          },
          name: 'Emily',
          summary: "Emily's best friend is Max the dog",
        },
      });
    });
  });
}
