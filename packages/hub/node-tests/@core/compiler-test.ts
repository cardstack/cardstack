import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { TestBuilder } from '../helpers/test-builder';
import { baseCardURL } from '@cardstack/core/src/compiler';

const PERSON_CARD = {
  url: 'https://cardstack.local/cards/person',
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
    let builder: TestBuilder;

    this.beforeEach(() => {
      builder = new TestBuilder();
    });

    it('string card', async function () {
      let compiled = await builder.getCompiledCard('https://cardstack.com/base/string');
      expect(compiled.adoptsFrom?.url).to.equal(baseCardURL);
      expect(compiled.embedded.inlineHBS).to.equal('{{@model}}');
      expect(compiled.embedded.usedFields).to.deep.equal([]);
      expect(!compiled.serializer, 'String card has no deserializer').to.be.ok;
    });

    it('date card', async function () {
      let compiled = await builder.getCompiledCard('https://cardstack.com/base/date');
      expect(compiled.serializer, 'Date card has date serializer').to.equal('date');
    });

    it('deserializer is inherited', async function () {
      builder.addRawCard({
        url: 'https://cardstack.local/cards/fancy-date',
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { adopts } from "@cardstack/types";
          import date from "https://cardstack.com/base/date";
          export default @adopts(date) class FancyDate { }`,
        },
      });
      let compiled = await builder.getCompiledCard('https://cardstack.local/cards/fancy-date');
      expect(compiled.serializer, 'FancyDate card has date serializer inherited from its parent').to.equal('date');
    });

    it('CompiledCard fields', async function () {
      builder.addRawCard(PERSON_CARD);
      let compiled = await builder.getCompiledCard(PERSON_CARD.url);
      expect(Object.keys(compiled.fields)).to.deep.equal(['name', 'birthdate']);
    });

    it('CompiledCard embedded view', async function () {
      builder.addRawCard(PERSON_CARD);
      let compiled = await builder.getCompiledCard(PERSON_CARD.url);

      expect(builder.definedModules.get(compiled.embedded.moduleName)).to.containsSource(
        '{{@model.name}} was born on <HttpsCardstackComBaseDateField @model={{@model.birthdate}} data-test-field-name=\\"birthdate\\" />'
      );

      expect(
        builder.definedModules.get('https://cardstack.local/cards/person/embedded.css'),
        'Styles are defined'
      ).to.containsSource(PERSON_CARD.files['embedded.css']);
    });

    it('CompiledCard edit view', async function () {
      builder.addRawCard(PERSON_CARD);
      let compiled = await builder.getCompiledCard(PERSON_CARD.url);

      expect(compiled.edit.usedFields).to.deep.equal(['name', 'birthdate']);
      expect(
        builder.definedModules.get(compiled.edit.moduleName),
        'Edit template is rendered for text'
      ).to.containsSource(
        '<HttpsCardstackComBaseStringField @model={{@model.name}} data-test-field-name=\\"name\\" @set={{@set.setters.name}} />'
      );
      expect(
        builder.definedModules.get(compiled.edit.moduleName),
        'Edit template is rendered for date'
      ).to.containsSource(
        '<HttpsCardstackComBaseDateField @model={{@model.birthdate}}  data-test-field-name=\\"birthdate\\" @set={{@set.setters.birthdate}} />'
      );
    });

    it('nested cards', async function () {
      builder.addRawCard(PERSON_CARD);
      builder.addRawCard({
        url: 'https://cardstack.local/cards/post',
        schema: 'schema.js',
        embedded: 'embedded.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import Person from "${PERSON_CARD.url}";
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

      let compiled = await builder.getCompiledCard('https://cardstack.local/cards/post');
      expect(compiled.fields).to.have.all.keys('title', 'author');

      expect(compiled.embedded.usedFields).to.deep.equal(['title', 'author.name', 'author.birthdate']);

      expect(builder.definedModules.get(compiled.embedded.moduleName)).to.containsSource(
        `<article><h1>{{@model.title}}</h1><p>{{@model.author.name}}</p><p><HttpsCardstackComBaseDateField @model={{@model.author.birthdate}} data-test-field-name=\\"birthdate\\"  /></p></article>`
      );

      expect(compiled.isolated.usedFields).to.deep.equal(['author']);
    });

    it('deeply nested cards', async function () {
      builder.addRawCard({
        url: 'http://cardstack.local/cards/post',
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
      builder.addRawCard({
        url: 'http://cardstack.local/cards/post-list',
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
        import post from "http://cardstack.local/cards/post";

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

      let compiled = await builder.getCompiledCard('http://cardstack.local/cards/post-list');
      expect(compiled.fields).to.have.all.keys('posts');

      expect(compiled.isolated.usedFields).to.deep.equal(['posts.title', 'posts.createdAt']);

      expect(
        builder.definedModules.get(compiled.isolated.moduleName),
        'Isolated template includes PostField component'
      ).to.containsSource(
        `{{#each @model.posts as |Post|}}<HttpCardstackLocalCardsPostField @model={{Post}} data-test-field-name=\\"posts\\" />{{/each}}`
      );

      expect(compiled.embedded.usedFields).to.deep.equal(['posts.title']);

      expect(
        builder.definedModules.get(compiled.embedded.moduleName),
        'Embedded template inlines post title'
      ).to.containsSource(`<ul>{{#each @model.posts as |Post|}}<li>{{Post.title}}</li>{{/each}}</ul>`);
    });

    describe('@fields iterating', function () {
      let postCard = {
        url: 'https://cardstack.local/cards/post',
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

      this.beforeEach(function () {
        builder.addRawCard(postCard);
      });

      it('iterators of fields and inlines templates', async function () {
        let compiled = await builder.getCompiledCard('https://cardstack.local/cards/post');
        expect(builder.definedModules.get(compiled.embedded.moduleName)).to.containsSource(
          '<article><label>{{\\"title\\"}}</label></article>'
        );
      });

      it('recompiled parent field iterator', async function () {
        let fancyPostCard = {
          url: 'https://cardstack.local/cards/fancy-post',
          schema: 'schema.js',
          files: {
            'schema.js': `
          import { contains, adopts } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import Post from "${postCard.url}";
          export default @adopts(Post) class FancyPost {
            @contains(string)
            body;
          }`,
          },
        };
        let timelyPostCard = {
          url: 'https://cardstack.local/cards/timely-post',
          schema: 'schema.js',
          files: {
            'schema.js': `
          import { contains, adopts } from "@cardstack/types";
          import date from "https://cardstack.com/base/date";
          import Post from "${postCard.url}";
          export default @adopts(Post) class TimelyPost {
            @contains(date)
            createdAt;
          }`,
          },
        };

        builder.addRawCard(fancyPostCard);
        builder.addRawCard(timelyPostCard);

        let timelyCompiled = await builder.getCompiledCard(timelyPostCard.url);
        let fancyCompiled = await builder.getCompiledCard(fancyPostCard.url);

        expect(builder.definedModules.get(timelyCompiled.embedded.moduleName)).to.containsSource(
          '<article><label>{{\\"title\\"}}</label><label>{{\\"createdAt\\"}}</label></article>'
        );
        expect(builder.definedModules.get(fancyCompiled.embedded.moduleName)).to.containsSource(
          '<article><label>{{\\"title\\"}}</label><label>{{\\"body\\"}}</label></article>'
        );
      });
    });
  });
}
