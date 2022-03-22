import cardAnalyze, { ExportMeta } from '@cardstack/core/src/babel-plugin-card-file-analyze';
import { analyzeComponent as fullAnalyzeComponent } from '@cardstack/core/src/babel-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';

if (process.env.COMPILER) {
  describe('BabelPluginCardAnalyze', function () {
    it('Returns empty meta information when there is nothing of note in the file', function () {
      let source = `function serializer() {}`;
      let out = cardAnalyze(source);
      expect(out).to.have.property('ast');
      expect(out.code).to.equal(source);
      expect(out.meta).to.deep.equal({ fields: {} });
    });

    it('It captures meta information about exports in the file', function () {
      let source = `
        export function serializer() {}
        export default class FancyClass {}
        export const KEEP = 'ME AROUND';
      `;
      let out = cardAnalyze(source);
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
      let out = cardAnalyze(source);
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
      let { meta } = cardAnalyze(source);

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
      let { meta } = cardAnalyze(source);

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

  describe('components', function () {
    function analyzeComponent(template: string) {
      return fullAnalyzeComponent(templateOnlyComponentTemplate(template), 'test.js');
    }

    it('string-like', async function () {
      let { meta } = analyzeComponent('{{@model}}');

      expect(meta).to.deep.equal({ model: 'self', fields: new Map() });
    });

    it('date-like', async function () {
      let { meta } = analyzeComponent('<FormatDate @date={{@model}} />');

      expect(meta).to.deep.equal({ model: 'self', fields: new Map() });
    });

    it('simple embeds', async function () {
      let { meta } = analyzeComponent('<@fields.title />');

      expect(meta.model, 'an empty set for usageMeta.model').to.deep.equal(new Set());
      expect(meta.fields, 'The title field to be in fields').to.deep.equal(new Map([['title', 'default']]));
    });

    it('simple model usage', async function () {
      let { meta } = analyzeComponent('{{helper @model.title}}');

      expect(meta).to.deep.equal({ model: new Set(['title']), fields: new Map() });
    });

    it('Nested usage', async function () {
      let { meta } = analyzeComponent(
        '{{@model.title}} - <@fields.post.createdAt /> - <@fields.post.author.birthdate />'
      );

      expect(meta).to.deep.equal({
        model: new Set(['title']),
        fields: new Map([
          ['post.createdAt', 'default'],
          ['post.author.birthdate', 'default'],
        ]),
      });
    });

    it('Block usage for self', async function () {
      let { meta } = analyzeComponent(
        '<Whatever @name={{name}} /> {{#each-in @fields as |name Field|}} <label>{{name}}</label> <Field /> {{/each-in}} <Whichever @field={{Field}} />'
      );

      expect(meta).to.deep.equal({ model: new Set(), fields: 'self' });
    });

    it('Block usage for field', async function () {
      let { meta } = analyzeComponent(
        '{{@model.plane}} {{#each @fields.birthdays as |Birthday|}} <Birthday /> {{#let (whatever) as |Birthday|}} <Birthday /> {{/let}} {{/each}}'
      );

      expect(meta).to.deep.equal({
        model: new Set(['plane']),
        fields: new Map([['birthdays', 'default']]),
      });
    });

    it('Block usage for fields field', async function () {
      let { meta } = analyzeComponent('{{#each @fields.birthdays as |Birthday|}} <Birthday.location /> {{/each}}');

      expect(meta).to.deep.equal({
        model: new Set(),
        fields: new Map([['birthdays.location', 'default']]),
      });
    });
  });
}
