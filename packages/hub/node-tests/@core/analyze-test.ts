import cardAnalyze, { ExportMeta } from '@cardstack/core/src/analyze';
import { InvalidFieldsUsageError, InvalidModelUsageError } from '@cardstack/core/src/glimmer-plugin-component-analyze';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';

if (process.env.COMPILER) {
  describe('card analyze', function () {
    it('Returns empty meta information when there is nothing of note in the file', function () {
      let source = `function serializer() {}`;
      let out = cardAnalyze(source, 'test.js');
      expect(out).to.have.property('ast');
      expect(out.code).to.equal(source);
      expect(out.meta).to.deep.equal({ component: undefined, fields: {} });
    });

    it('It captures meta information about exports in the file', function () {
      let source = `
        export function serializer() {}
        export default class FancyClass {}
        export const KEEP = 'ME AROUND';
      `;
      let out = cardAnalyze(source, 'test.js');
      expect(out.code).to.containsSource(source);
      expect(out).to.have.property('ast');
      expect(out.meta).to.have.property('exports');

      let members: ExportMeta[] = [
        { type: 'FunctionDeclaration', name: 'serializer' },
        { type: 'VariableDeclaration', name: 'KEEP' },
        { type: 'ClassDeclaration', name: 'default' },
      ];
      expect(out.meta.exports).to.have.deep.members(members);
    });

    it('produces meta about information about the schema', async function () {
      let source = `
  	    import { contains } from "@cardstack/types";
  	    import string from "https://cardstack.com/base/string";
  	    import date from "https://cardstack.com/base/date";

  	    export default class Address {
  	      @contains(string) street;
  	      @contains(string) city;
  	      @contains(string) state;
  	      @contains(string) zip;
  	      @contains(date) settlementDate;
  	    }
  	  `;
      let out = cardAnalyze(source, 'test.js');
      expect(out).to.have.property('ast');
      expect(out).to.have.property('code');
      expect(out).to.have.property('meta');

      let { meta } = out;

      expect(meta.parent).to.be.undefined;

      expect(meta.fields).to.deep.property('street', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: false,
      });
      expect(meta.fields).to.deep.property('city', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: false,
      });
      expect(meta.fields).to.deep.property('state', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: false,
      });
      expect(meta.fields).to.deep.property('zip', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: false,
      });
      expect(meta.fields).to.deep.property('settlementDate', {
        cardURL: 'https://cardstack.com/base/date',
        type: 'contains',
        typeDecoratorLocalName: 'date',
        computed: false,
      });
    });

    it('adds synchronous computed info to fieldMeta', async function () {
      let source = `
  	    import { contains } from "@cardstack/types";
  	    import string from "https://cardstack.com/base/string";
  	    import date from "https://cardstack.com/base/date";

  	    export default class Address {
  	      @contains(string) street;

  	      @contains(string)
					get home() {
						return this.street + " is home";
					};
  	    }
  	  `;
      let { meta } = cardAnalyze(source, 'test.js');

      expect(meta.fields).to.deep.property('street', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: false,
      });

      expect(meta.fields).to.deep.property('home', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: true,
      });
    });

    it('adds async computed info to fieldMeta', async function () {
      let source = `
  	    import { contains } from "@cardstack/types";
  	    import string from "https://cardstack.com/base/string";
  	    import date from "https://cardstack.com/base/date";

  	    export default class Address {
  	      @contains(string) street;

  	      @contains(string, { computeVia: "computeHome" }) home
					async computeHome() {
						return (await this.street) + " is home";
					};
  	    }
  	  `;
      let { meta } = cardAnalyze(source, 'test.js');

      expect(meta.fields).to.deep.property('street', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: false,
      });

      expect(meta.fields).to.deep.property('home', {
        cardURL: 'https://cardstack.com/base/string',
        type: 'contains',
        typeDecoratorLocalName: 'string',
        computed: true,
        computeVia: 'computeHome',
      });
    });
  });

  describe('card analyze: components', function () {
    function analyzeComponent(template: string) {
      let out = cardAnalyze(templateOnlyComponentTemplate(template), 'test.js');
      return out.meta.component!;
    }

    it('string-like', async function () {
      let component = analyzeComponent('{{@model}}');

      expect(component.default).to.deep.equal({
        usage: { model: 'self', fields: new Map() },
        rawHBS: '{{@model}}',
        hasModifiedScope: false,
      });
    });

    it('date-like', async function () {
      let component = analyzeComponent('<FormatDate @date={{@model}} />');

      expect(component.default.usage).to.deep.equal({ model: 'self', fields: new Map() });
    });

    it('simple embeds', async function () {
      let component = analyzeComponent('<@fields.title />');

      expect(component.default.usage.model, 'an empty set for usageMeta.model').to.deep.equal(new Set());
      expect(component.default.usage.fields, 'The title field to be in fields').to.deep.equal(
        new Map([['title', 'default']])
      );
    });

    it('simple model usage', async function () {
      let component = analyzeComponent('{{helper @model.title}}');

      expect(component.default.usage).to.deep.equal({ model: new Set(['title']), fields: new Map() });
    });

    it('Nested usage', async function () {
      let component = analyzeComponent(
        '{{@model.title}} - <@fields.post.createdAt /> - <@fields.post.author.birthdate />'
      );

      expect(component.default.usage).to.deep.equal({
        model: new Set(['title']),
        fields: new Map([
          ['post.createdAt', 'default'],
          ['post.author.birthdate', 'default'],
        ]),
      });
    });

    it('Block usage for self', async function () {
      let component = analyzeComponent(
        '<Whatever @name={{name}} /> {{#each-in @fields as |name Field|}} <label>{{name}}</label> <Field /> {{/each-in}} <Whichever @field={{Field}} />'
      );

      expect(component.default.usage).to.deep.equal({ model: new Set(), fields: 'self' });
    });

    it('Block usage for @model path', async function () {
      let component = analyzeComponent(
        '<Whatever @name={{@model.title}} /> {{#each @model.comments as |comment|}} <Other @name={{comment.createdAt}}/> {{/each}} <Whichever @field={{Field}} />'
      );

      expect(component.default.usage).to.deep.equal({
        model: new Set(['title', 'comments.createdAt']),
        fields: new Map(),
      });
    });

    it('Block usage for field', async function () {
      let component = analyzeComponent(
        '{{@model.plane}} {{#each @fields.birthdays as |Birthday|}} <Birthday /> {{#let (whatever) as |Birthday|}} <Birthday /> {{/let}} {{/each}}'
      );

      expect(component.default.usage).to.deep.equal({
        model: new Set(['plane']),
        fields: new Map([['birthdays', 'default']]),
      });
    });

    it('Block usage for fields field', async function () {
      let component = analyzeComponent('{{#each @fields.birthdays as |Birthday|}} <Birthday.location /> {{/each}}');

      expect(component.default.usage).to.deep.equal({
        model: new Set(),
        fields: new Map([['birthdays.location', 'default']]),
      });
    });

    it('Component is a named export', async function () {
      let { meta } = cardAnalyze(
        templateOnlyComponentTemplate(
          '<FancyTool @value={{@model}} />',
          { FancyTool: '@org/fancy-tool/component' },
          'foo'
        ),
        'test.js'
      );

      expect(meta.component).to.deep.equal({
        foo: {
          usage: { model: 'self', fields: new Map() },
          rawHBS: '<FancyTool @value={{@model}} />',
          hasModifiedScope: true,
        },
      });
    });

    it('Has multiple named exports for component', async function () {
      let template = `import { setComponentTemplate } from '@ember/component';
      import { precompileTemplate } from '@ember/template-compilation';
      import templateOnlyComponent from '@ember/component/template-only';

      export default setComponentTemplate(
        precompileTemplate('<h1>Hello world</h1>', { strictMode: true }), templateOnlyComponent()
      );

      export const named = setComponentTemplate(
        precompileTemplate('<h1>Goodbye</h1>', { strictMode: true }), templateOnlyComponent()
      );
      `;

      let { meta } = cardAnalyze(template, 'test.js');

      expect(meta.component).to.deep.equal({
        default: {
          usage: { model: new Set(), fields: new Map() },
          rawHBS: '<h1>Hello world</h1>',
          hasModifiedScope: false,
        },
        named: {
          usage: { model: new Set(), fields: new Map() },
          rawHBS: '<h1>Goodbye</h1>',
          hasModifiedScope: false,
        },
      });
    });

    it('Understands when a card has modified the scope of a template', async function () {
      let { meta } = cardAnalyze(
        templateOnlyComponentTemplate('<FancyTool @value={{@model}} />', { FancyTool: '@org/fancy-tool/component' }),
        'test.js'
      );

      expect(meta.component).to.deep.equal({
        default: {
          usage: { model: 'self', fields: new Map() },
          rawHBS: '<FancyTool @value={{@model}} />',
          hasModifiedScope: true,
        },
      });
    });

    describe('Error handling', function () {
      it('errors when using @model as an element', async function () {
        try {
          analyzeComponent('<@model.pizza />');
          throw new Error('failed to throw expected exception');
        } catch (e: any) {
          expect(e).to.be.instanceOf(InvalidModelUsageError);
        }
      });

      it('errors when using @model as an element inside of a block', async function () {
        try {
          analyzeComponent('{{#each @model.birthdays as |birthday|}} <birthday /> {{/each}}');
          throw new Error('failed to throw expected exception');
        } catch (e: any) {
          expect(e).to.be.instanceOf(InvalidModelUsageError);
        }

        try {
          analyzeComponent('{{#each @model.birthdays as |birthday|}} <birthday.location /> {{/each}}');
          throw new Error('failed to throw expected exception');
        } catch (e: any) {
          expect(e).to.be.instanceOf(InvalidModelUsageError);
        }
      });

      it('errors when using @fields as an element without a path', async function () {
        try {
          analyzeComponent('<@fields />');
          throw new Error('failed to throw expected exception');
        } catch (e: any) {
          expect(e).to.be.instanceOf(InvalidFieldsUsageError);
        }
      });
    });
  });
}
