import QUnit from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { containsSource } from '@cardstack/core/tests/helpers/assertions';
import { TestBuilder } from '../helpers/test-builder';

const { module: Qmodule, test } = QUnit;

Qmodule('Compiler', function (hooks) {
  let builder: TestBuilder;

  hooks.beforeEach(() => {
    builder = new TestBuilder();
  });

  test('simplest example', async function (assert) {
    builder.addRawCard({
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
          '<@model.name/> was born on <@model.birthdate/>'
        ),
      },
    });

    let compiled = await builder.getCompiledCard('https://mirage/cards/person');
    assert.deepEqual(Object.keys(compiled.fields), ['name', 'birthdate']);
    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      '{{@model.name}} was born on <BirthdateField @model={{@model.birthdate}} />'
    );
  });

  test('field iterator example', async function () {
    builder.addRawCard({
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
    });

    let compiled = await builder.getCompiledCard('https://mirage/cards/post');
    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      '<article><label>{{\\"title\\"}}</label></article>'
    );
  });

  test('recompiled parent field iterator', async function () {
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

    builder.addRawCard(postCard);
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
