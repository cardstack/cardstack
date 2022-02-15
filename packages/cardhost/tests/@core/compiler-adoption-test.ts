import { module, test } from 'qunit';
import { LOCAL_REALM } from 'cardhost/lib/builder';
import type {
  Builder,
  CompiledCard,
  RawCard,
} from '@cardstack/core/src/interfaces';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { cardURL } from '@cardstack/core/src/utils';
import type Cards from 'cardhost/services/cards';
import { setupCardTest } from '../helpers/setup';

module('@core | compiler-adoption', function (hooks) {
  let { createCard } = setupCardTest(hooks);

  let parentCard: CompiledCard;

  let PERSON_CARD: RawCard = {
    realm: LOCAL_REALM,
    id: 'person',
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
        `<@fields.name/> was born on <@fields.birthdate/>`
      ),
    },
  };

  let builder: Builder;
  let cardService: Cards;
  hooks.beforeEach(async function () {
    createCard(PERSON_CARD);
    cardService = this.owner.lookup('service:cards');
    builder = await cardService.builder();

    parentCard = await builder.getCompiledCard(`${LOCAL_REALM}person`);
  });

  module('fields', function (/*hooks*/) {
    test('a blank card can adopt fields from a card', async function (assert) {
      let card = {
        id: 'user',
        realm: LOCAL_REALM,
        adoptsFrom: '../person',
      };
      createCard(card);

      let compiled = await builder.getCompiledCard(cardURL(card));
      assert.deepEqual(Object.keys(compiled.fields), ['name', 'birthdate']);
      assert.deepEqual(compiled.adoptsFrom, parentCard);
      assert.equal(
        compiled.componentInfos.embedded.moduleName,
        parentCard.componentInfos.embedded.moduleName,
        'It reports the module name for the template that it adopts'
      );
    });

    test('A child card can add a field', async function (assert) {
      let card = {
        id: 'user',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "${LOCAL_REALM}person";
          import string from "https://cardstack.com/base/string";

          export default @adopts(Person) class User {
            @contains(string)
            username
          }
      `,
        },
      };
      createCard(card);

      let compiled = await builder.getCompiledCard(cardURL(card));
      assert.deepEqual(Object.keys(compiled.fields), [
        'name',
        'birthdate',
        'username',
      ]);
    });

    test('A child card can NOT overwrite an existing field', async function (assert) {
      let card: RawCard = {
        id: 'user',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "${LOCAL_REALM}person";
          import string from "https://cardstack.com/base/string";

          export default @adopts(Person) class User {
            @contains(string)
            birthdate
          }
      `,
        },
      };

      createCard(card);
      assert.expect(1);
      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.equal(
          err.message,
          `Field collision on birthdate with parent card ${LOCAL_REALM}person`
        );
      }
    });

    test('A child card can NOT overwrite an existing field, even from a grandparent', async function (assert) {
      createCard({
        id: 'user',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "${LOCAL_REALM}person";
          import string from "https://cardstack.com/base/string";

          export default @adopts(Person) class User {
            @contains(string)
            username
          }`,
        },
      });

      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import User from "${LOCAL_REALM}user";
          import string from "https://cardstack.com/base/string";

          export default @adopts(User) class Admin {
            @contains(string)
            name
          }
      `,
        },
      };

      createCard(card);
      assert.expect(1);
      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.equal(
          err.message,
          `Field collision on name with parent card ${LOCAL_REALM}user`
        );
      }
    });
  });

  module('templates', function (/*hooks*/) {
    test('a child card inherits a parent card template', async function (assert) {
      let card = {
        id: 'user',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";
            import Person from "${LOCAL_REALM}person";

            export default @adopts(Person) class User {}
        `,
        },
      };
      createCard(card);

      let compiledCard = await builder.getCompiledCard(cardURL(card));

      assert.ok(
        await cardService.loadModule(
          compiledCard.componentInfos.embedded.moduleName.global
        ),
        'Has a embedded component'
      );
    });

    test('a child card inherits a grandparent card template, when it and parent do not have templates', async function (assert) {
      createCard({
        id: 'user',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "${LOCAL_REALM}person";
          import string from "https://cardstack.com/base/string";

          export default @adopts(Person) class User {
            @contains(string)
            username
          }`,
        },
      });
      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";
            import User from "${LOCAL_REALM}user";

            export default @adopts(User) class Admin {}
        `,
        },
      };
      createCard(card);

      let compiledCard = await builder.getCompiledCard(cardURL(card));
      assert.ok(
        await cardService.loadModule(
          compiledCard.componentInfos.embedded.moduleName.global
        ),
        'Has a embedded component'
      );
    });
  });

  module('errors', function () {
    test('@adopts cannot be used on a class property', async function (assert) {
      assert.expect(1);
      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";
            import Person from "${LOCAL_REALM}person";

            export default class Admin {
              @adopts(Person)
              user
            }
        `,
        },
      };

      createCard(card);
      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@adopts decorator can only be used on a class/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts only accepts 1 argument', async function (assert) {
      assert.expect(1);
      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";
            import Person from "${LOCAL_REALM}person";

            export default @adopts(Person, true) class Admin {}
        `,
        },
      };
      createCard(card);

      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@adopts decorator can only have 1 argument/.test(err.message)
        );
      }
    });

    test('@adopts with wrong argument syntax', async function (assert) {
      assert.expect(1);
      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";

            export default @adopts('Person') class Admin {}
        `,
        },
      };
      createCard(card);

      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@adopts argument must be an identifier/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts doesnt accept undefined arguments', async function (assert) {
      assert.expect(1);
      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";

            export default @adopts(Person) class Admin {}
        `,
        },
      };
      createCard(card);

      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@adopts argument is not defined/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts argument must be imported', async function (assert) {
      assert.expect(1);
      let card = {
        id: 'admin',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts } from "@cardstack/types";
            const Person = 'person'

            export default @adopts(Person) class Admin {}
        `,
        },
      };
      createCard(card);

      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@adopts argument must come from a module default export/.test(
            err.message
          ),
          err.message
        );
      }
    });
  });
});
