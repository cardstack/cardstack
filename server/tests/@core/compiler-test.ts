import QUnit, { only } from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { containsSource } from '@cardstack/core/tests/helpers/assertions';
import { TestBuilder } from '../helpers/test-builder';

const { module: Qmodule, test } = QUnit;

const PERSON_CARD = {
  url: 'https://mirage/cards/person',
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
      '<@fields.name/> was born on <@fields.birthdate/>'
    ),
  },
};

Qmodule('Compiler', function (hooks) {
  let builder: TestBuilder;

  hooks.beforeEach(() => {
    builder = new TestBuilder();
  });

  test('string card', async function (assert) {
    let compiled = await builder.getCompiledCard(
      'https://cardstack.com/base/string'
    );
    assert.ok(!compiled.deserializer, 'String card has no deserializer');
  });

  test('date card', async function (assert) {
    let compiled = await builder.getCompiledCard(
      'https://cardstack.com/base/date'
    );
    assert.equal(
      compiled.deserializer,
      'date',
      'Date card has date serializer'
    );
  });

  test('deserializer is inherited', async function (assert) {
    builder.addRawCard({
      url: 'https://mirage/cards/fancy-date',
      schema: 'schema.js',
      files: {
        'schema.js': `
          import { adopts } from "@cardstack/types";
          import date from "https://cardstack.com/base/date";
          export default @adopts(date) class FancyDate { }`,
      },
    });
    let compiled = await builder.getCompiledCard(
      'https://mirage/cards/fancy-date'
    );
    assert.equal(
      compiled.deserializer,
      'date',
      'FancyDate card has date serializer inherited from its parent'
    );
  });

  test('basic example', async function (assert) {
    builder.addRawCard(PERSON_CARD);

    let compiled = await builder.getCompiledCard(PERSON_CARD.url);
    assert.deepEqual(Object.keys(compiled.fields), ['name', 'birthdate']);

    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      '{{@model.name}} was born on <BirthdateField @model={{@model.birthdate}} />'
    );

    assert.deepEqual(
      compiled.embedded.deserialize,
      { date: ['birthdate'] },
      'Embedded component has a deserialization map'
    );
  });

  test('nested cards', async function (assert) {
    builder.addRawCard(PERSON_CARD);
    builder.addRawCard({
      url: 'https://mirage/cards/post',
      schema: 'schema.js',
      embedded: 'embedded.js',
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
      },
    });

    let compiled = await builder.getCompiledCard('https://mirage/cards/post');
    assert.deepEqual(Object.keys(compiled.fields), ['title', 'author']);

    assert.deepEqual(compiled.embedded.usedFields, [
      'title',
      'author.name',
      'author.birthdate',
    ]);

    assert.deepEqual(
      compiled.embedded.deserialize,
      { date: ['author.birthdate'] },
      'Embedded component has a deserialization map'
    );

    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      `<article><h1>{{@model.title}}</h1><p>{{@model.author.name}}</p><p><BirthdateField @model={{@model.author.birthdate}} /></p></article>`
    );
  });

  Qmodule('@fields iterating', function (hooks) {
    let postCard = {
      url: 'https://mirage/cards/post',
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
      let compiled = await builder.getCompiledCard('https://mirage/cards/post');
      containsSource(
        builder.definedModules.get(compiled.embedded.moduleName),
        '<article><label>{{\\"title\\"}}</label></article>'
      );
    });

    test('recompiled parent field iterator', async function () {
      let fancyPostCard = {
        url: 'https://mirage/cards/fancy-post',
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
        url: 'https://mirage/cards/timely-post',
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
