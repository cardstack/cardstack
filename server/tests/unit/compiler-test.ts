import QUnit from 'qunit';
import { Compiler } from '@cardstack/core/src/compiler';
import { Builder, CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { containsSource } from '@cardstack/core/tests/helpers/assertions';
import { setupCardBuilding } from '../../src/context/card-building';
import { BASE_CARD_REALM_CONFIG } from '../helpers/fixtures';
import { createCardCacheDir } from '../helpers/cache';

const { module: Qmodule, test } = QUnit;

const baseBuilder = (() => {
  let { cardCacheDir } = createCardCacheDir();
  return setupCardBuilding({
    realms: [BASE_CARD_REALM_CONFIG],
    cardCacheDir,
  });
})();

class TestBuilder implements Builder {
  compiler: Compiler;
  rawCards: Map<string, RawCard> = new Map();
  definedModules: Map<string, string> = new Map();

  constructor() {
    this.compiler = new Compiler({
      builder: this,
      define: this.define.bind(this),
    });
  }

  async getRawCard(url: string): Promise<RawCard> {
    let card = this.rawCards.get(url);
    if (!card) {
      card = await baseBuilder.getRawCard(url);
    }
    return card;
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let card = this.rawCards.get(url);
    if (card) {
      return await this.compiler.compile(card);
    } else {
      return await baseBuilder.getCompiledCard(url);
    }
  }

  private async define(
    cardURL: string,
    localModule: string,
    src: string
  ): Promise<string> {
    let moduleName = cardURL.replace(/\/$/, '') + '/' + localModule;
    this.definedModules.set(moduleName, src);
    return moduleName;
  }

  addRawCard(rawCard: RawCard) {
    this.rawCards.set(rawCard.url, rawCard);
  }
}

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
    builder.addRawCard({
      url: 'https://mirage/cards/fancy-post',
      schema: 'schema.js',
      files: {
        'schema.js': `
          import { contains, adopts } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import Post from "https://mirage/cards/post";
          export default @adopts(Post) class FancyPost {
            @contains(string)
            body;
          }`,
      },
    });

    let compiled = await builder.getCompiledCard(
      'https://mirage/cards/fancy-post'
    );

    containsSource(
      builder.definedModules.get(compiled.embedded.moduleName),
      '<article><label>{{\\"title\\"}}</label><label>{{\\"body\\"}}</label></article>'
    );
  });
});
