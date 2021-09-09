import QUnit from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { containsSource } from '@cardstack/core/tests/helpers/assertions';
import { TestBuilder } from '../helpers/test-builder';
import { baseCardURL } from '@cardstack/core/src/compiler';

const { module: Qmodule, test } = QUnit;

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

Qmodule('Compiler', function (hooks) {
  let builder: TestBuilder;

  hooks.beforeEach(() => {
    builder = new TestBuilder();
  });

  test('string card', async function (assert) {
    let compiled = await builder.getCompiledCard('https://cardstack.com/base/string');
    assert.equal(compiled.adoptsFrom?.url, baseCardURL);
    assert.equal(compiled.embedded.inlineHBS, '{{@model}}');
    assert.deepEqual(compiled.embedded.usedFields, []);
    assert.ok(!compiled.serializer, 'String card has no deserializer');
  });

  test('date card', async function (assert) {
    let compiled = await builder.getCompiledCard('https://cardstack.com/base/date');
    assert.equal(compiled.serializer, 'date', 'Date card has date serializer');
  });

  test('deserializer is inherited', async function (assert) {
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
    assert.equal(compiled.serializer, 'date', 'FancyDate card has date serializer inherited from its parent');
  });

  test('CompiledCard fields', async function (assert) {
    builder.addRawCard(PERSON_CARD);
    let compiled = await builder.getCompiledCard(PERSON_CARD.url);
    assert.deepEqual(Object.keys(compiled.fields), ['name', 'birthdate']);
  });

  test('CompiledCard embedded view', async function () {
    builder.addRawCard(PERSON_CARD);
    let compiled = await builder.getCompiledCard(PERSON_CARD.url);

    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      '{{@model.name}} was born on <HttpsCardstackComBaseDateField @model={{@model.birthdate}} data-test-field-name=\\"birthdate\\" />'
    );

    containsSource(
      builder.definedModules.get('https://cardstack.local/cards/person/embedded.css'),
      PERSON_CARD.files['embedded.css'],
      'Styles are defined'
    );
  });

  test('CompiledCard edit view', async function (assert) {
    builder.addRawCard(PERSON_CARD);
    let compiled = await builder.getCompiledCard(PERSON_CARD.url);

    assert.deepEqual(compiled.edit.usedFields, ['name', 'birthdate']);
    containsSource(
      builder.definedModules.get(compiled.edit.moduleName),
      '<HttpsCardstackComBaseStringField @model={{@model.name}} data-test-field-name=\\"name\\" @set={{@set.setters.name}} />',
      'Edit template is rendered for text'
    );
    containsSource(
      builder.definedModules.get(compiled.edit.moduleName),
      '<HttpsCardstackComBaseDateField @model={{@model.birthdate}}  data-test-field-name=\\"birthdate\\" @set={{@set.setters.birthdate}} />',
      'Edit template is rendered for date'
    );
  });

  test('nested cards', async function (assert) {
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
    assert.deepEqual(Object.keys(compiled.fields), ['title', 'author']);

    assert.deepEqual(compiled.embedded.usedFields, ['title', 'author.name', 'author.birthdate']);

    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      `<article><h1>{{@model.title}}</h1><p>{{@model.author.name}}</p><p><HttpsCardstackComBaseDateField @model={{@model.author.birthdate}} data-test-field-name=\\"birthdate\\"  /></p></article>`
    );

    assert.deepEqual(compiled.isolated.usedFields, ['author']);
  });

  test('deeply nested cards', async function (assert) {
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
    assert.deepEqual(Object.keys(compiled.fields), ['posts']);

    assert.deepEqual(compiled.isolated.usedFields, ['posts.title', 'posts.createdAt']);

    containsSource(
      builder.definedModules.get(compiled.isolated.moduleName),
      `{{#each @model.posts as |Post|}}<HttpCardstackLocalCardsPostField @model={{Post}} data-test-field-name=\\"posts\\" />{{/each}}`,
      'Isolated template includes PostField component'
    );

    assert.deepEqual(compiled.embedded.usedFields, ['posts.title']);

    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      `<ul>{{#each @model.posts as |Post|}}<li>{{Post.title}}</li>{{/each}}</ul>`,
      'Embedded template inlines post title'
    );
  });

  Qmodule('@fields iterating', function (hooks) {
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

    hooks.beforeEach(function () {
      builder.addRawCard(postCard);
    });

    test('iterators of fields and inlines templates', async function () {
      let compiled = await builder.getCompiledCard('https://cardstack.local/cards/post');
      containsSource(
        builder.definedModules.get(compiled.embedded.moduleName),
        '<article><label>{{\\"title\\"}}</label></article>'
      );
    });

    test('recompiled parent field iterator', async function () {
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

      containsSource(
        builder.definedModules.get(timelyCompiled.embedded.moduleName),
        '<article><label>{{\\"title\\"}}</label><label>{{\\"createdAt\\"}}</label></article>'
      );
      containsSource(
        builder.definedModules.get(fancyCompiled.embedded.moduleName),
        '<article><label>{{\\"title\\"}}</label><label>{{\\"body\\"}}</label></article>'
      );
    });
  });
});
