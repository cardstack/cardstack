import { CompiledCard } from '@cardstack/core/src/interfaces';
import transform, { Options } from '@cardstack/core/src/glimmer-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import CardBuilder from '../../services/card-builder';
import { setupHub } from '../helpers/server';

function importAndChooseName() {
  return 'BestGuess';
}

if (process.env.COMPILER) {
  describe('Glimmer CardTemplatePlugin', function () {
    let builder: CardBuilder;
    let options: Options;
    let defaultFieldFormat: Options['defaultFieldFormat'];
    let usageMeta: Options['usageMeta'];
    let compiledStringCard: CompiledCard, compiledDateCard: CompiledCard, compiledListCard: CompiledCard;

    let { cards, realm, getContainer } = setupHub(this);

    this.beforeEach(async () => {
      builder = await getContainer().lookup('card-builder');
      await cards.create({
        url: `${realm}list`,
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { contains, containsMany } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";
          export default class NestedItems {
            @contains(string)
            name;

            @containsMany(string)
            items;

            @containsMany(date)
            dates;
          }`,
        },
      });
      compiledListCard = await builder.getCompiledCard(`${realm}list`);
      compiledStringCard = await builder.getCompiledCard('https://cardstack.com/base/string');
      compiledDateCard = await builder.getCompiledCard('https://cardstack.com/base/date');
    });

    this.beforeEach(function () {
      usageMeta = { model: new Set(), fields: new Map() };
      defaultFieldFormat = 'embedded';
    });

    describe('Primitive Fields', function () {
      it('string-like', async function () {
        let template = transform('{{@model}}', {
          fields: {},
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        });
        expect(template).to.equal('{{@model}}');

        expect(usageMeta['model']).to.equal('self');
        expect(usageMeta['fields']).to.deep.equal(new Map());
      });

      it('date-like', async function () {
        let template = transform('<FormatDate @date={{@model}} />', {
          fields: {},
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        });
        expect(template).to.equal('<FormatDate @date={{@model}} />');
        expect(usageMeta['model']).to.equal('self');
        expect(usageMeta['fields']).to.deep.equal(new Map());
      });
    });

    describe('Fields: contains', function () {
      it('Simple embeds', async function () {
        let template = transform('<@fields.title />', {
          fields: {
            title: {
              card: compiledStringCard,
              name: 'title',
              type: 'contains',
            },
          },
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        });

        expect(template, 'Component invocation is converted to handlebars expression').to.deep.equal(
          '{{@model.title}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['title', defaultFieldFormat]]));
      });

      it('simple model usage', async function () {
        let template = transform('{{helper @model.title}}', {
          fields: {
            title: {
              card: compiledStringCard,
              name: 'title',
              type: 'contains',
            },
          },
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        });

        expect(template, 'Component invocation is converted to handlebars expression').to.deep.equal(
          '{{helper @model.title}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set(['title']));
        expect(usageMeta['fields']).to.deep.equal(new Map());
      });

      it('Embedding with imports', async function () {
        // assert.expect(6);
        let template = transform('<@fields.createdAt />', {
          fields: {
            createdAt: {
              type: 'contains',
              card: compiledDateCard,
              name: 'createdAt',
            },
          },
          usageMeta,
          defaultFieldFormat,
          importAndChooseName(desiredName: string, moduleSpecifier: string, importedName: string) {
            expect(desiredName, 'desiredName is based on the type of card').to.deep.equal('HttpsCardstackComBaseDate');
            expect(importedName, 'Uses the default import').to.deep.equal('default');
            expect(
              moduleSpecifier.startsWith('@cardstack/compiled/https-cardstack.com-base-date/embedded'),
              'ImporedPath starts with dates embedded'
            );
            return 'HttpsCardstackComBaseDateField';
          },
        });

        expect(template, 'Use the desired importname at component invocation site').to.equal(
          '<HttpsCardstackComBaseDateField @model={{@model.createdAt}} data-test-field-name="createdAt" />'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['createdAt', defaultFieldFormat]]));
      });

      it('Nested fields', async function () {
        let template = transform('<@fields.title /><@fields.list.name />', {
          fields: {
            title: {
              card: compiledStringCard,
              name: 'title',
              type: 'contains',
            },
            list: {
              card: compiledListCard,
              name: 'list',
              type: 'contains',
            },
          },
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        });

        expect(template, 'Component invocation is converted to handlebars expression').to.equal(
          '{{@model.title}}{{@model.list.name}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(
          new Map([
            ['title', defaultFieldFormat],
            ['list.name', defaultFieldFormat],
          ])
        );
      });
    });

    describe('Fields: inlinable: containsMany', function () {
      this.beforeEach(function () {
        options = {
          fields: {
            items: {
              card: compiledStringCard,
              name: 'items',
              type: 'containsMany',
            },
            list: {
              card: compiledListCard,
              name: 'list',
              type: 'contains',
            },
          },
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        };
      });

      it('each-as loops for strings', async function () {
        expect(
          transform('{{#each @fields.items as |Item|}}{{#if condition}}<Item />{{/if}}<Other />{{/each}}', options)
        ).to.equal('{{#each @model.items as |Item|}}{{#if condition}}{{Item}}{{/if}}<Other />{{/each}}');
        expect(usageMeta['model']).to.deep.equal(new Set(), 'No @model usage meta');
        expect(usageMeta['fields']).to.deep.equal(new Map([['items', defaultFieldFormat]]), 'items as @field meta');
      });

      it('each-as loops for strings in nested cards', async function () {
        expect(
          transform('{{#each @fields.list.items as |Item|}}{{#if condition}}<Item />{{/if}}<Other />{{/each}}', options)
        ).to.equal('{{#each @model.list.items as |Item|}}{{#if condition}}{{Item}}{{/if}}<Other />{{/each}}');
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['list.items', defaultFieldFormat]]));
      });

      it('Compononet invocation for strings', async function () {
        let template = transform('<@fields.items />', options);

        expect(template).to.equal('{{#each @model.items as |item|}}{{item}}{{/each}}');
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['items', defaultFieldFormat]]));
      });

      it('Compononet invocation for nested fields', async function () {
        let template = transform('<@fields.list.items />', options);

        expect(template).to.equal('{{#each @model.list.items as |item|}}{{item}}{{/each}}');
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['list.items', defaultFieldFormat]]));
      });
    });

    describe('Fields: not-inlinable: containsMany', function () {
      this.beforeEach(function () {
        options = {
          fields: {
            items: {
              name: 'items',
              card: compiledDateCard,
              type: 'containsMany',
            },
            list: {
              name: 'list',
              card: compiledListCard,
              type: 'contains',
            },
          },
          usageMeta,
          importAndChooseName,
          defaultFieldFormat,
        };
      });

      it('each-as loops for dates', async function () {
        expect(
          transform('{{#each @fields.items as |Item|}}<Item />{{/each}}', options),
          '{{#each @model.items as |Item|}}<BestGuess @model={{Item}} data-test-field-name="items" />{{/each}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['items', defaultFieldFormat]]));
      });

      it('each-as loops for dates in nested card', async function () {
        expect(
          transform('{{#each @fields.list.dates as |ADate|}}<ADate />{{/each}}', options),
          '{{#each @model.list.dates as |ADate|}}<BestGuess @model={{ADate}} data-test-field-name="dates" />{{/each}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['list.dates', defaultFieldFormat]]));
      });

      it('component invocation for dates', async function () {
        expect(
          transform('<@fields.items />', options),
          '{{#each @model.items as |item|}}<BestGuess @model={{item}} data-test-field-name="items" />{{/each}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['items', defaultFieldFormat]]));
      });

      it('component invocation for dates in nested card', async function () {
        expect(
          transform('<@fields.list.dates />', options),
          '{{#each @model.list.dates as |date|}}<BestGuess @model={{date}} data-test-field-name="dates" />{{/each}}'
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(new Map([['list.dates', defaultFieldFormat]]));
      });
    });

    it('Tracking deeply nested field usage', async function () {
      await cards.create({
        url: `${realm}post`,
        schema: 'schema.js',
        isolated: 'isolated.js',
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
        }
      `,
          'isolated.js': templateOnlyComponentTemplate(`<h1><@fields.title /></h1><h2><@fields.createdAt /></h2>`),
          'embedded.js': templateOnlyComponentTemplate(`<h2><@fields.title /> - <@fields.createdAt /></h2>`),
        },
      });
      let template = `{{#each @fields.posts as |Post|}}<Post />{{/each}}`;
      await cards.create({
        url: `${realm}post-list`,
        schema: 'schema.js',
        isolated: 'isolated.js',
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
          'isolated.js': templateOnlyComponentTemplate(template),
        },
      });

      let card = await builder.getCompiledCard(`${realm}post-list`);
      transform(template, {
        fields: card.fields,
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });
      expect(usageMeta['model']).to.deep.equal(new Set());
      expect(usageMeta['fields']).to.deep.equal(new Map([['posts', defaultFieldFormat]]));
    });

    describe('@fields API', function () {
      this.beforeEach(function () {
        options = {
          fields: {
            title: {
              type: 'contains',
              card: compiledStringCard,
              name: 'title',
            },
            startDate: {
              type: 'contains',
              card: compiledDateCard,
              name: 'startDate',
            },
            items: {
              type: 'containsMany',
              card: compiledStringCard,
              name: 'items',
            },
            events: {
              type: 'containsMany',
              card: compiledDateCard,
              name: 'events',
            },
          },
          usageMeta,
          defaultFieldFormat,
          importAndChooseName,
        };
      });

      // Reminder: as we wrote this, we decided that `<@fields.startDate />` can
      // just always replace `<@model.startDate />` for the invocation case, and
      // `{{@model.startDate}}` is *always* only the data.
      it('{{#each-in}} over fields', async function () {
        expect(
          transform(
            `
            <Whatever @name={{name}} />
            {{#each-in @fields as |name Field|}}
              <label>{{name}}</label>
              <Field />
           {{/each-in}}
           <Whichever @field={{Field}} />
           `,
            options
          )
        ).to.equalIgnoringWhiteSpace(
          `
          <Whatever @name={{name}} />
          <label>{{"title"}}</label>
         {{@model.title}}
         <label>{{"startDate"}}</label>
         <BestGuess @model={{@model.startDate}} data-test-field-name="startDate" />
         <label>{{"items"}}</label>
         {{#each @model.items as |item|}}{{item}}{{/each}}
         <label>{{"events"}}</label>
         {{#each @model.events as |event|}}<BestGuess @model={{event}} data-test-field-name="events" />{{/each}}
         <Whichever @field={{Field}} />
         `
        );
        expect(usageMeta['model']).to.deep.equal(new Set());
        expect(usageMeta['fields']).to.deep.equal(
          new Map([
            ['title', defaultFieldFormat],
            ['startDate', defaultFieldFormat],
            ['items', defaultFieldFormat],
            ['events', defaultFieldFormat],
          ])
        );
      });
    });

    it('Avoids rewriting shadowed vars', async function () {
      expect(
        transform(
          `{{#each @fields.birthdays as |Birthday|}}
              <Birthday />
              {{#let (whatever) as |Birthday|}}
                <Birthday />
              {{/let}}
           {{/each}}`,
          {
            usageMeta,
            importAndChooseName,
            defaultFieldFormat,
            fields: {
              birthdays: {
                name: 'birthdays',
                card: compiledDateCard,
                type: 'containsMany',
              },
            },
          }
        )
      ).to.equalIgnoringWhiteSpace(
        `{{#each @model.birthdays as |Birthday|}}
          <BestGuess @model={{Birthday}} data-test-field-name="birthdays" />
          {{#let (whatever) as |Birthday|}}
            <Birthday />
          {{/let}}
        {{/each}}`
      );
      expect(usageMeta['model']).to.deep.equal(new Set());
      expect(usageMeta['fields']).to.deep.equal(new Map([['birthdays', defaultFieldFormat]]));
    });

    describe('Error Scenarios', function () {
      it('Errors when you wrap a field invocation in a helper', async function () {
        expect(function () {
          transform('{{#each (helper @fields.items) as |Item|}}<Item />{{/each}}', options);
        }).to.throw(/Invalid use of @fields API/);
      });

      it('Errors when trying to pass @fields API through helper', async function () {
        expect(function () {
          transform(
            `{{#each-in (some-helper @fields) as |name Field|}}
                <label>{{name}}</label>
               {{/each-in}}`,
            options
          );
        }).to.throw(/Invalid use of @fields API/);
      });

      it('Errors when using @fields as a component argument', async function () {
        expect(function () {
          transform(`<SomeCompontent @arrg={{@fields}} />`, options);
        }).to.throw(/Invalid use of @fields API/);
      });

      it('Errors when calling @fields as a element node', async function () {
        expect(function () {
          transform(`<@fields />`, options);
        }).to.throw(/Invalid use of @fields API/);
      });

      it('Errors when using @fields in a each loop', async function () {
        expect(function () {
          transform(
            `{{#each @fields as |Field|}}
                <label>{{name}}</label>
               {{/each}}`,
            options
          );
        }, 'Errors when used with an each loops').to.throw(/Invalid use of @fields API/);
      });

      it('Errors when using @fields as path expression', async function () {
        expect(function () {
          transform(
            `{{#each-in @fields as |name Field|}}
                    <label>{{name}}</label>
                    <Field />
                    {{@fields}}
                 {{/each-in}}`,
            options
          );
        }, 'Errors when fields is used incorrectly inside of a valid use of fields').to.throw(
          /Invalid use of @fields API/
        );
      });
    });
  });
}
