import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { baseCardURL } from '@cardstack/core/src/compiler';
import { TEST_REALM as realm } from '@cardstack/core/tests/helpers/fixtures';
import { configureHubWithCompiler } from '../helpers/cards';
import { RawCard } from '@cardstack/core/src/interfaces';
import { cardURL } from '@cardstack/core/src/utils';

const PERSON_CARD: RawCard = {
  realm,
  id: 'person',
  schema: 'schema.js',
  embedded: 'embedded.js',
  files: {
    'schema.js': `
      import { contains } from "@cardstack/types";
      import date from "https://cardstack.com/base/date";
      import string from "https://cardstack.com/base/string";
      export default class Person {
        @contains(string)
        name;

        @contains(date)
        birthdate;
      }`,
    'embedded.js': templateOnlyComponentTemplate(
      '<div class="person-embedded"><@fields.name/> was born on <@fields.birthdate/></div>'
    ),
    'embedded.css': `.person-embedded { background: green }`,
  },
};

if (process.env.COMPILER) {
  describe('Compiler', function () {
    let { cards, getFileCache } = configureHubWithCompiler(this);

    it('string card', async function () {
      let { compiled } = await cards.load('https://cardstack.com/base/string');
      expect(compiled.adoptsFrom?.url).to.equal(baseCardURL);
      expect(compiled.componentInfos.embedded.inlineHBS).to.equal('{{@model}}');
      expect(compiled.componentInfos.embedded.usedFields).to.deep.equal([]);
      expect(!compiled.serializer, 'String card has no deserializer').to.be.ok;
    });

    it('date card', async function () {
      let { compiled } = await cards.load('https://cardstack.com/base/date');
      expect(compiled.serializer, 'Date card has date serializer').to.equal('date');
    });

    it('deserializer is inherited', async function () {
      await cards.create({
        realm,
        id: 'fancy-date',
        adoptsFrom: 'https://cardstack.com/base/date',
      });
      let { compiled } = await cards.load(`${realm}fancy-date`);
      expect(compiled.serializer, 'FancyDate card has date serializer inherited from its parent').to.equal('date');
    });

    it('CompiledCard fields', async function () {
      await cards.create(PERSON_CARD);
      let { compiled } = await cards.load(cardURL(PERSON_CARD));
      expect(Object.keys(compiled.fields)).to.deep.equal(['name', 'birthdate']);
      let nameFieldMeta = compiled.fields['name'];
      expect(nameFieldMeta).to.have.property('name', 'name');
      expect(nameFieldMeta).to.have.property('type', 'contains');
      expect(nameFieldMeta).to.have.property('computed', false);
    });

    it('CompiledCard embedded view', async function () {
      await cards.create(PERSON_CARD);
      let { compiled } = await cards.load(cardURL(PERSON_CARD));

      expect(getFileCache().getModule(compiled.componentInfos.embedded.moduleName.global)).to.containsSource(
        '{{@model.name}} was born on <HttpsCardstackComBaseDateField @model={{@model.birthdate}} data-test-field-name=\\"birthdate\\" />'
      );

      expect(getFileCache().getAsset(`${realm}person`, 'embedded.css'), 'Styles are defined').to.containsSource(
        PERSON_CARD.files!['embedded.css']
      );
    });

    it('CompiledCard edit view', async function () {
      await cards.create(PERSON_CARD);
      let { compiled } = await cards.load(cardURL(PERSON_CARD));

      expect(compiled.componentInfos.edit.usedFields).to.deep.equal(['name', 'birthdate']);
      expect(
        getFileCache().getModule(compiled.componentInfos.edit.moduleName.global),
        'Edit template is rendered for text'
      ).to.containsSource(
        '<HttpsCardstackComBaseStringField @model={{@model.name}} data-test-field-name=\\"name\\" @set={{@set.setters.name}} />'
      );
      expect(
        getFileCache().getModule(compiled.componentInfos.edit.moduleName.global),
        'Edit template is rendered for date'
      ).to.containsSource(
        '<HttpsCardstackComBaseDateField @model={{@model.birthdate}}  data-test-field-name=\\"birthdate\\" @set={{@set.setters.birthdate}} />'
      );
    });

    it('nested cards', async function () {
      await cards.create(PERSON_CARD);
      await cards.create({
        realm,
        id: 'post',
        schema: 'schema.js',
        embedded: 'embedded.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import Person from "${cardURL(PERSON_CARD)}";
          export default class Post {
            @contains(string)
            title;

            @contains(Person)
            author;
          }`,
          'embedded.js': templateOnlyComponentTemplate(
            `<article><h1><@fields.title /></h1><p><@fields.author.name /></p><p><@fields.author.birthdate /></p></article>`
          ),
          'isolated.js': templateOnlyComponentTemplate(`<SomeRandoComponent @attr={{@model.author}} />`),
        },
      });

      let { compiled } = await cards.load(`${realm}post`);
      expect(compiled.fields).to.have.all.keys('title', 'author');

      expect(compiled.componentInfos.embedded.usedFields).to.deep.equal(['title', 'author.name', 'author.birthdate']);

      expect(getFileCache().getModule(compiled.componentInfos.embedded.moduleName.global)).to.containsSource(
        `<article><h1>{{@model.title}}</h1><p>{{@model.author.name}}</p><p><HttpsCardstackComBaseDateField @model={{@model.author.birthdate}} data-test-field-name=\\"birthdate\\"  /></p></article>`
      );

      expect(compiled.componentInfos.isolated.usedFields).to.deep.equal(['author']);
    });

    it('deeply nested cards', async function () {
      await cards.create({
        realm,
        id: 'post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        embedded: 'embedded.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import date from "https://cardstack.com/base/date";

            export default class Hello {
              @contains(string)
              title;

              @contains(date)
              createdAt;

              @contains(string)
              body;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            `<h1><@fields.title /></h1><h2><@fields.createdAt /></h2><p>{{@model.body}}</p>`
          ),
          'embedded.js': templateOnlyComponentTemplate(`<h2><@fields.title /> - <@fields.createdAt /></h2>`),
        },
      });
      await cards.create({
        realm,
        id: 'post-list',
        schema: 'schema.js',
        isolated: 'isolated.js',
        embedded: 'embedded.js',
        data: {
          posts: [
            {
              title: 'A blog post title',
              createdAt: '2021-05-17T15:31:21+0000',
            },
          ],
        },
        files: {
          'schema.js': `
            import { containsMany } from "@cardstack/types";
            import post from "https://cardstack.local/post";

            export default class Hello {
              @containsMany(post)
              posts;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate('{{#each @fields.posts as |Post|}}<Post />{{/each}}'),
          'embedded.js': templateOnlyComponentTemplate(
            '<ul>{{#each @fields.posts as |Post|}}<li><Post.title /></li>{{/each}}</ul>'
          ),
        },
      });

      let { compiled } = await cards.load(`${realm}post-list`);
      expect(compiled.fields).to.have.all.keys('posts');

      expect(compiled.componentInfos.isolated.usedFields).to.deep.equal(['posts.title', 'posts.createdAt']);

      expect(
        getFileCache().getModule(compiled.componentInfos.isolated.moduleName.global),
        'Isolated template includes PostField component'
      ).to.containsSource(
        `{{#each @model.posts as |Post|}}<HttpsCardstackLocalPostField @model={{Post}} data-test-field-name=\\"posts\\" />{{/each}}`
      );

      expect(compiled.componentInfos.embedded.usedFields).to.deep.equal(['posts.title']);

      expect(
        getFileCache().getModule(compiled.componentInfos.embedded.moduleName.global),
        'Embedded template inlines post title'
      ).to.containsSource(`<ul>{{#each @model.posts as |Post|}}<li>{{Post.title}}</li>{{/each}}</ul>`);
    });

    it(`gives a good error when a card can't compile because adoptsFrom does not exist`, async function () {
      let rawCard: RawCard = { realm, id: 'post', adoptsFrom: '../post' };
      try {
        await cards.create(rawCard);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`tried to adopt from card ${realm}post but it failed to load`);
        expect(err.status).to.eq(422);
      }
    });

    it(`gives a good error when a card can't compile because field does not exist`, async function () {
      let rawCard: RawCard = {
        realm,
        id: 'post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import person from "../person";
            export default class Post {
              @contains(person) author;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate('<@field.author.name />'),
        },
      };
      try {
        await cards.create(rawCard);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`tried to lookup field 'author' but it failed to load`);
        expect(err.status).to.eq(422);
      }
    });

    it(`gives a good error when a card can't compile because computed field has args`, async function () {
      let badCard: RawCard = {
        realm,
        id: 'bad-person',
        schema: 'schema.js',
        files: {
          'schema.js': `
          import string from "https://cardstack.com/base/string";
          import { contains } from "@cardstack/types";
          import person from "../person";
          export default class BadPerson {
            @contains(string) lastName;
            @contains(string)
            async fullName(arg) {
              return "Mr or Mrs " + (await this.lastName());
            }
          }
        `,
        },
      };
      try {
        await cards.create(badCard);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(`computed fields take no arguments`);
        expect(err.status).to.eq(400);
      }
    });

    it(`gives a good error when a card can't compile because computed field has static name`, async function () {
      let badCard: RawCard = {
        realm,
        id: 'bad-person',
        schema: 'schema.js',
        files: {
          'schema.js': `
          import string from "https://cardstack.com/base/string";
          import { contains } from "@cardstack/types";
          import person from "../person";
          export default class BadPerson {
            @contains(string) lastName;
            @contains(string)
            static async fullName() {
              return "Mr or Mrs " + (await this.lastName());
            }
          }
        `,
        },
      };
      try {
        await cards.create(badCard);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(`computed fields should not be static`);
        expect(err.status).to.eq(400);
      }
    });

    describe('@fields iterating', function () {
      let postCard: RawCard = {
        realm,
        id: 'post',
        schema: 'schema.js',
        embedded: 'embedded.js',
        files: {
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          export default class Post {
            @contains(string)
            title;
          }`,
          'embedded.js': templateOnlyComponentTemplate(
            `<article>{{#each-in @fields as |name|}}<label>{{name}}</label>{{/each-in}}</article>`
          ),
        },
      };

      this.beforeEach(async function () {
        await cards.create(postCard);
      });

      it('iterators of fields and inlines templates', async function () {
        let { compiled } = await cards.load(`${realm}post`);
        expect(getFileCache().getModule(compiled.componentInfos.embedded.moduleName.global)).to.containsSource(
          '<article><label>{{\\"title\\"}}</label></article>'
        );
      });

      it('recompiled parent field iterator', async function () {
        let fancyPostCard: RawCard = {
          realm,
          id: 'fancy-post',
          schema: 'schema.js',
          files: {
            'schema.js': `
          import { contains, adopts } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import Post from "${cardURL(postCard)}";
          export default @adopts(Post) class FancyPost {
            @contains(string)
            body;
          }`,
          },
        };
        let timelyPostCard: RawCard = {
          realm,
          id: 'timely-post',
          schema: 'schema.js',
          files: {
            'schema.js': `
          import { contains, adopts } from "@cardstack/types";
          import date from "https://cardstack.com/base/date";
          import Post from "${cardURL(postCard)}";
          export default @adopts(Post) class TimelyPost {
            @contains(date)
            createdAt;
          }`,
          },
        };

        await cards.create(fancyPostCard);
        await cards.create(timelyPostCard);

        let { compiled: timelyCompiled } = await cards.load(cardURL(timelyPostCard));
        let { compiled: fancyCompiled } = await cards.load(cardURL(fancyPostCard));

        expect(getFileCache().getModule(timelyCompiled.componentInfos.embedded.moduleName.global)).to.containsSource(
          '<article><label>{{\\"title\\"}}</label><label>{{\\"createdAt\\"}}</label></article>'
        );
        expect(getFileCache().getModule(fancyCompiled.componentInfos.embedded.moduleName.global)).to.containsSource(
          '<article><label>{{\\"title\\"}}</label><label>{{\\"body\\"}}</label></article>'
        );
      });
    });

    describe('computed fields', function () {
      let fancyDateCard: RawCard = {
        realm,
        id: 'fancy-date',
        adoptsFrom: 'https://cardstack.com/base/date',
      };
      let bioCard: RawCard = {
        realm,
        id: 'bio',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import date from "https://cardstack.com/base/date";

            export default class Bio {
              @contains(date) birthdate;
            }
          `,
        },
      };
      let personCard: RawCard = {
        realm,
        id: 'person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import bio from "../bio";
            export default class Person {
              @contains(string) lastName;
              @contains(bio) aboutMe;

              @contains(string)
              async fullName() {
                return "Mr or Mrs " + await this.lastName;
              }
            }
          `,
        },
      };
      let fancyPersonCard: RawCard = {
        realm,
        id: 'fancy-person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";
            import person from "../person";
            export default @adopts(person) class FancyPerson {

            }
          `,
        },
      };
      let reallyFancyPersonCard: RawCard = {
        realm,
        id: 'really-fancy-person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts, contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import fancyPerson from "../fancy-person";
            export default @adopts(fancyPerson) class ReallyFancyPerson {
              @contains(string) middleName;
            }
          `,
        },
      };

      this.beforeEach(async function () {
        await cards.create(fancyDateCard);
        await cards.create(bioCard);
        await cards.create(personCard);
        await cards.create(fancyPersonCard);
        await cards.create(reallyFancyPersonCard);
      });

      it('can compile schema class constructor for composite card', async function () {
        let { compiled } = await cards.load(`${realm}bio`);
        // the browser source has a lot less babel shenanigans
        let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
        expect(source).to.containsSource(`
          #getRawField;

          constructor(get) {
            this.#getRawField = get;
          }
        `);
      });

      it('can compile primitive field implementation in schema.js module', async function () {
        let { compiled } = await cards.load(`${realm}bio`);
        let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
        expect(source).to.not.containsSource(`@contains`);
        expect(source).to.not.containsSource(`https://cardstack.com/base/string`);
        expect(source).to.containsSource(`
          import FieldGetter from "@cardstack/core/src/field-getter";
        `);
        expect(source).to.containsSource(`
          get birthdate() {
            return new FieldGetter(this.#getRawField, "birthdate");
          }
        `);
      });

      it('can compile composite field implementation in schema.js module', async function () {
        let { compiled } = await cards.load(`${realm}person`);
        let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
        expect(source).to.not.containsSource(`@contains`);
        expect(source).to.not.containsSource(`${realm}bio`);
        expect(source).to.containsSource(`
          import BioClass from "@cardstack/compiled/https-cardstack.local-bio/schema.js";
        `);
        expect(source).to.containsSource(`
          get aboutMe() {
            return new BioClass(innerField => this.#getRawField("aboutMe." + innerField));
          }
        `);
      });

      it('can compile computed field in schema.js module', async function () {
        let { compiled } = await cards.load(`${realm}person`);
        let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
        expect(source).to.not.containsSource(`@contains`);
        expect(source).to.containsSource(`
          get fullName() {
            return (async () => {
              return "Mr or Mrs " + (await this.lastName);
            })();
          }
        `);
      });

      it('can compile a schema.js that adopts from a composite card has no additional fields', async function () {
        let { compiled } = await cards.load(`${realm}fancy-person`);
        let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
        expect(source).to.containsSource(`
          import PersonClass from "@cardstack/compiled/https-cardstack.local-person/schema.js";
          export default class FancyPerson extends PersonClass {}
        `);
      });

      it('can make a constructor for a schema.js that adopts from a composite card has additional fields', async function () {
        let { compiled } = await cards.load(`${realm}really-fancy-person`);
        let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
        expect(source).to.containsSource(`
          #getRawField;

          constructor(get) {
            super(get);
            this.#getRawField = get;
          }
        `);
      });

      it(`doesn't allow a card that adopts from a primitive card to become a composite card by having fields`, async function () {
        let parentURL = cardURL(fancyDateCard);
        let badCard = {
          realm,
          id: 'bad-date',
          schema: 'schema.js',
          files: {
            'schema.js': `
              import { adopts, contains } from "@cardstack/types";
              import fancyDate from "${parentURL}";
              import string from "https://cardstack.com/base/string";
              export default @adopts(fancyDate) class BadDate {
                @contains(string) constellation;
              }`,
          },
        };

        try {
          await cards.create(badCard);
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.equal(
            `Card ${cardURL(
              badCard
            )} adopting from primitive parent ${parentURL} must be of primitive type itself and should not have a schema.js file.`
          );
        }
      });
    });

    describe('linksTo', function () {
      let postCard: RawCard = {
        realm,
        id: 'post',
        schema: 'schema.js',
        embedded: 'embedded.js',
        files: {
          'schema.js': `
          import { linksTo } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          export default class Post {
            @linksTo(string)
            title;
          }`,
          'embedded.js': templateOnlyComponentTemplate(`<@fields.title />`),
        },
      };

      this.beforeEach(async function () {
        await cards.create(postCard);
      });

      it('Can understand linksTo fields', async function () {
        let { compiled } = await cards.load(`${realm}post`);

        expect(compiled.fields.title.name).to.eq('title');
        expect(compiled.fields.title.type).to.eq('linksTo');
        expect(compiled.componentInfos.embedded.usedFields).to.have.members(['title']);
      });
    });
  });
}
