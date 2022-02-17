import cardSchemaAnalyze, { getMeta } from '@cardstack/core/src/babel-plugin-card-schema-analyze';

if (process.env.COMPILER) {
  describe('BabelPluginCardSchemaAnalyze', function () {
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
      let out = cardSchemaAnalyze(source, options);
      expect(out).to.have.property('ast');
      expect(out).to.have.property('code');

      let meta = getMeta(options);

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
      cardSchemaAnalyze(source, options);
      let meta = getMeta(options);

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
      cardSchemaAnalyze(source, options);
      let meta = getMeta(options);

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
}
