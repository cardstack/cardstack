import cardAnalyze, { ExportMeta, ImportMeta } from '@cardstack/core/src/babel-plugin-card-file-analyze';

if (process.env.COMPILER) {
  describe('BabelPluginCardAnalyze', function () {
    it('Returns empty meta information when there is nothing of note in the file', function () {
      let options = {};
      let source = `function serializer() {}`;
      let out = cardAnalyze(source, options);
      expect(out).to.have.property('ast');
      expect(out.code).to.equal(source);
      expect(out.meta).to.deep.equal({});
    });

    it('It captures meta information about exports in the file', function () {
      let options = {};
      let source = `
        export function serializer() {}
        export default class FancyClass {}
        export const KEEP = 'ME AROUND';
        export { templateOnlyComponent } from './a-file';
      `;
      let out = cardAnalyze(source, options);
      expect(out.code).to.containsSource(source);
      expect(out).to.have.property('ast');
      expect(out.meta).to.have.property('exports');

      let members: ExportMeta[] = [
        { type: 'declaration', declarationType: 'FunctionDeclaration', name: 'serializer' },
        { type: 'declaration', declarationType: 'VariableDeclaration', name: 'KEEP' },
        { type: 'declaration', declarationType: 'ClassDeclaration', name: 'default' },
        { type: 'reexport', locals: ['templateOnlyComponent'], source: './a-file' },
      ];
      expect(out.meta.exports).to.have.deep.members(members);
    });

    it('produces meta about information about the schema', async function () {
      let options = {};
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
      let out = cardAnalyze(source, options);
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
      let options = {};
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
      let { meta } = cardAnalyze(source, options);

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
      let options = {};
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
      let { meta } = cardAnalyze(source, options);

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

    it('responds gracefully component files', async function () {
      let options = {};
      let source = `
        import { setComponentTemplate } from '@ember/component';
        import { precompileTemplate } from '@ember/template-compilation';
        import templateOnlyComponent from '@ember/component/template-only';

        export default setComponentTemplate(
          precompileTemplate(
            \`<div class="user">
              <strong class="user__name"><@fields.name/></strong>
              <p><@fields.description/></p>
            </div>\`,
            {
              strictMode: true,
              scope: () => ({}),
            }
          ),
          templateOnlyComponent()
        );
  	  `;
      let { meta } = cardAnalyze(source, options);

      let members: ImportMeta[] = [
        { specifiers: ['setComponentTemplate'], source: '@ember/component' },
        { specifiers: ['precompileTemplate'], source: '@ember/template-compilation' },
        { specifiers: ['templateOnlyComponent'], source: '@ember/component/template-only' },
      ];
      expect(meta.imports).to.have.deep.members(members);
    });
  });
}
