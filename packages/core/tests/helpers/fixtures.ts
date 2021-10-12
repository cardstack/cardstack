/* eslint-disable @typescript-eslint/naming-convention */
import { templateOnlyComponentTemplate } from './templates';

export const ADDRESS_RAW_CARD = {
  url: 'https://cardstack.local/address',
  schema: 'schema.js',
  embedded: 'embedded.js',
  files: {
    'schema.js': `
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
	  `,
    'embedded.js': templateOnlyComponentTemplate(
      `<p><@fields.street /><br /> <@fields.city />, <@fields.state /> <@fields.zip /></p><p>Moved In: <@fields.settlementDate /></p>`
    ),
  },
};

export const PERSON_RAW_CARD = {
  url: 'https://cardstack.local/person',
  schema: 'schema.js',
  isolated: 'isolated.js',
  files: {
    'schema.js': `
	    import { contains } from "@cardstack/types";
	    import string from "https://cardstack.com/base/string";
	    import date from "https://cardstack.com/base/date";
	    import address from "https://cardstack.local/address";

	    export default class Person {
	      @contains(string) name;
	      @contains(date) birthdate;
	      @contains(address) address;
	  	}
		`,
    'isolated.js': templateOnlyComponentTemplate(
      `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/></div>`,
      { IsolatedStyles: './isolated.css' }
    ),
    'isolated.css': '.person-isolated { background: red }',
  },
};
