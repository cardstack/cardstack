import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { TEST_REALM as realm } from '@cardstack/core/tests/helpers/fixtures';
import { configureHubWithCompiler } from '../helpers/cards';
import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { BASE_CARD_URL, cardURL } from '@cardstack/core/src/utils';

const PERSON_CARD: RawCard = {
  realm,
  id: 'person',
  schema: 'schema.js',
  embedded: 'embedded.js',
  isolated: 'isolated.js',
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
    'isolated.js': templateOnlyComponentTemplate(
      `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/></div>`
    ),
    'embedded.js': templateOnlyComponentTemplate(
      '<div class="person-embedded"><@fields.name/> was born on <@fields.birthdate/></div>'
    ),
    'embedded.css': `.person-embedded { background: green }`,
  },
};

if (process.env.COMPILER) {
  describe('Compiler', function () {
    let { cards, getFileCache, resolveCard } = configureHubWithCompiler(this);

    it('string card', async function () {
      let { compiled } = await cards.load('https://cardstack.com/base/string');
      expect(compiled.adoptsFrom?.url).to.equal(BASE_CARD_URL);
      expect(compiled.componentInfos.embedded.inlineHBS).to.equal('{{@model}}');
      expect(compiled.componentInfos.embedded.usedFields).to.deep.equal([]);
      expect(!compiled.serializerModule, 'String card has no deserializer').to.be.ok;
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

      expect(getFileCache().getModule(compiled.componentInfos.embedded.componentModule.global)).to.containsSource(
        `<article><h1>{{@model.title}}</h1><p>{{@model.author.name}}</p><p><HttpsCardstackComBaseDateField @model={{@model.author.birthdate}} data-test-field-name=\\"birthdate\\"  /></p></article>`
      );

      expect(compiled.componentInfos.isolated.usedFields).to.deep.equal(['author']);
    });

    describe('Components compliation', function () {
      let compiled: CompiledCard;

      this.beforeEach(async function () {
        let card = await cards.create(PERSON_CARD);
        compiled = card.compiled;
      });

      it('defines the component modules within the card itself', async function () {
        // Because this card defines it's own schema
        let {
          embedded: {
            componentModule: { global: embeddedGlobal },
          },
          edit: {
            componentModule: { global: editGlobal },
          },
          isolated: {
            componentModule: { global: isolatedGlobal },
          },
        } = compiled.componentInfos;

        expect(isolatedGlobal).to.equal('@cardstack/compiled/https-cardstack.local-person/isolated.js');
        expect(resolveCard(isolatedGlobal), 'isolated resolved location').to.match(
          /cardstack.local-person\/isolated.js/
        );
        expect(editGlobal).to.equal('@cardstack/compiled/https-cardstack.local-person/edit.js');
        expect(resolveCard(editGlobal), 'edit resolved location').to.match(/cardstack.local-person\/edit.js/);
        expect(embeddedGlobal).to.equal('@cardstack/compiled/https-cardstack.local-person/embedded.js');
        expect(resolveCard(embeddedGlobal), 'embedded resolved location').to.match(
          /cardstack.local-person\/embedded.js/
        );
      });

      it('Recompiles glimmer templates', async function () {
        let { embedded, edit } = compiled.componentInfos;
        expect(getFileCache().getModule(embedded.componentModule.global)).to.containsSource(
          '{{@model.name}} was born on <HttpsCardstackComBaseDateField @model={{@model.birthdate}} data-test-field-name=\\"birthdate\\" />'
        );

        let editSource = getFileCache().getModule(edit.componentModule.global);
        expect(editSource, 'Edit template is rendered for text').to.containsSource(
          '<HttpsCardstackComBaseStringField @model={{@model.name}} data-test-field-name=\\"name\\" @set={{@set.setters.name}} />'
        );
        expect(editSource, 'Edit template is rendered for date').to.containsSource(
          '<HttpsCardstackComBaseDateField @model={{@model.birthdate}}  data-test-field-name=\\"birthdate\\" @set={{@set.setters.birthdate}} />'
        );
      });

      it('defines assets, such as css files', async function () {
        expect(getFileCache().getAsset(`${realm}person`, 'embedded.css'), 'Styles are defined').to.containsSource(
          PERSON_CARD.files!['embedded.css']
        );
      });

      it('Computes used fields', async function () {
        let { isolated, embedded, edit } = compiled.componentInfos;

        expect(isolated.usedFields, 'Isolated usedFields').to.deep.equal(['name']);
        expect(embedded.usedFields, 'Embedded usedFields').to.deep.equal(['name', 'birthdate']);
        expect(edit.usedFields, 'Edit Fields').to.deep.equal(['name', 'birthdate']);
      });

      it('supports reusing the same component for different views', async function () {
        let card = await cards.create({
          realm,
          adoptsFrom: '../person',
          id: 'big-person',
          embedded: 'isolated.js',
          isolated: 'isolated.js',
          files: {
            'isolated.js': templateOnlyComponentTemplate(
              `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/></div>`
            ),
          },
        });

        expect(card.compiled.componentInfos.embedded).to.deep.equal(card.compiled.componentInfos.isolated);
      });
    });

    it('handles complex component adoptions', async function () {
      await cards.create({
        realm,
        id: 'person',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Person {
              @contains(string) name;
            }`,
          'isolated.js': templateOnlyComponentTemplate(
            `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/></div>`,
            { IsolatedStyles: './isolated.css', add: './add.js' }
          ),
          'isolated.css': `.person-isolated { background: green }`,
          'add.js': `export default function add(one) { return one + 1; }`,
        },
      });

      let fancyPerson = await cards.create({
        realm,
        id: 'fancy-person',
        schema: 'schema.js',
        embedded: 'embedded.js',
        adoptsFrom: '../person',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class FancyPerson {
              @contains(string) fancyTitle;
            }`,
          'embedded.js': templateOnlyComponentTemplate(
            `<div class="person-embedded" data-test-person>Hi! I am <@fields.name/></div>`
          ),
        },
      });

      let {
        embedded: {
          componentModule: { global: embeddedGlobal },
        },
        edit: {
          componentModule: { global: editGlobal },
        },
        isolated: {
          componentModule: { global: isolatedGlobal },
        },
      } = fancyPerson.compiled.componentInfos;

      expect(isolatedGlobal).to.equal('@cardstack/compiled/https-cardstack.local-fancy-person/isolated.js');
      expect(resolveCard(isolatedGlobal), 'isolated resolved location').to.match(
        /cardstack.local-fancy-person\/isolated.js/
      );
      expect(editGlobal).to.equal('@cardstack/compiled/https-cardstack.local-fancy-person/edit.js');
      expect(resolveCard(editGlobal), 'edit location is not in the base cards').to.match(
        /cardstack.local-fancy-person\/edit.js/
      );
      expect(embeddedGlobal).to.equal('@cardstack/compiled/https-cardstack.local-fancy-person/embedded.js');
      expect(resolveCard(embeddedGlobal), 'embedded resolved location').to.match(
        /cardstack.local-fancy-person\/embedded.js/
      );

      let isolatedTemplate = getFileCache().getModule(isolatedGlobal, 'browser');
      // TODO: Update with paths from modules outputs from person
      expect(isolatedTemplate, 'Relative js imports from parent card are rewritten').to.containsSource(
        'import add from "@cardstack/compiled/https-cardstack.local-person/add.js"'
      );
      expect(isolatedTemplate, 'Relative css imports from parent card are rewritten').to.containsSource(
        'import IsolatedStyles from "@cardstack/compiled/https-cardstack.local-person/isolated.css"'
      );
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
        getFileCache().getModule(compiled.componentInfos.isolated.componentModule.global),
        'Isolated template includes PostField component'
      ).to.containsSource(
        `{{#each @model.posts as |Post|}}<HttpsCardstackLocalPostField @model={{Post}} data-test-field-name=\\"posts\\" />{{/each}}`
      );

      expect(compiled.componentInfos.embedded.usedFields).to.deep.equal(['posts.title']);

      expect(
        getFileCache().getModule(compiled.componentInfos.embedded.componentModule.global),
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

    describe('Custom Serializers', function () {
      it('date card', async function () {
        let { compiled } = await cards.load('https://cardstack.com/base/date');
        expect(compiled.serializerModule?.global, 'Date card has date serializer').to.be.ok;
        expect(compiled.componentInfos.embedded.inlineHBS).to.be.undefined;
        let serializer = getFileCache().getModule(compiled.serializerModule?.global!, 'browser');
        expect(serializer).to.containsSource(`export function serialize(d) {`);
      });

      it('serializers are inherited', async function () {
        await cards.create({
          realm,
          id: 'fancy-date',
          adoptsFrom: 'https://cardstack.com/base/date',
        });
        let { compiled: dateCompiled } = await cards.load('https://cardstack.com/base/date');
        let { compiled } = await cards.load(`${realm}fancy-date`);
        expect(
          compiled.serializerModule?.global,
          'FancyDate card has date serializer inherited from its parent'
        ).to.equal(dateCompiled.serializerModule?.global);
      });

      it('Errors when the serializer is declared but the file doesnt exist', async function () {
        try {
          await cards.create({
            realm,
            id: 'primitive',
            serializer: 'serializer.js',
            embedded: 'embedded.js',
            files: {
              'embedded.js': templateOnlyComponentTemplate('<@field.author.name />'),
            },
          });
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.include(`card declared 'serializer.js' but there is no module to declare`);
          expect(err.status).to.eq(422);
        }
      });

      it('Errors when the serializer is malformed', async function () {
        try {
          await cards.create({
            realm,
            id: 'primitive-with-bad-serializer',
            serializer: 'serializer.js',
            files: {
              'serializer.js': `
                export function serialize() {}
              `,
            },
          });
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.include(`Serializer is malformed. It is missing the following exports: deserialize`);
          expect(err.status).to.eq(422);
        }
      });
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
        expect(getFileCache().getModule(compiled.componentInfos.embedded.componentModule.global)).to.containsSource(
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

        expect(
          getFileCache().getModule(timelyCompiled.componentInfos.embedded.componentModule.global)
        ).to.containsSource('<article><label>{{\\"title\\"}}</label><label>{{\\"createdAt\\"}}</label></article>');
        expect(
          getFileCache().getModule(fancyCompiled.componentInfos.embedded.componentModule.global)
        ).to.containsSource('<article><label>{{\\"title\\"}}</label><label>{{\\"body\\"}}</label></article>');
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
