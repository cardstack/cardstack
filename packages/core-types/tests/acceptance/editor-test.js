import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, fillIn } from '@ember/test-helpers';
import { selectChoose } from 'ember-power-select/test-support/helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import RSVP from 'rsvp';

function run(fn) {
  return RSVP.resolve().then(() => fn.apply(this, arguments));
}

module('Integration | Component | field editors/dropdown choices editor', async function(hooks) {
  setupApplicationTest(hooks);

  let scenario = new Fixtures({
    create(factory) {
      factory.addResource('content-types', 'drivers')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'feeling').withAttributes({
            fieldType: '@cardstack/core-types::belongs-to',
            editorComponent: 'field-editors/dropdown-choices-editor'
          }).withRelated('related-types', [
            factory.addResource('content-types', 'feelings')
              .withRelated('fields', [
                factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' })
            ])
          ])
      ]);

      let happyFeeling = factory.addResource('feelings', '1').withAttributes({ title: 'Happy' });
      factory.addResource('feelings', '2').withAttributes({ title: 'Sad' });
      factory.addResource('feelings', '3').withAttributes({ title: 'Exuberant' });
      factory.addResource('feelings', '4').withAttributes({ title: 'Melancholy' });

      factory.addResource('drivers', 'metalmario')
        .withAttributes({ name: 'Metal Mario' })
        .withRelated('feeling', happyFeeling);
    },

    destroy() {
      return [{ type: 'feelings' }];
    }
  });

  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
    this.store = this.owner.lookup('service:store');
  });

  test('visiting /editor', async function(assert) {
    await visit('/editor');
    assert.equal(currentURL(), '/editor');

    let model = await run(() => {
      return this.store.findRecord('driver', 'metalmario');
    });
    let feeling = await model.get('feeling.title');

    assert.equal(feeling, 'Happy', 'metal mario is happy');

    await fillIn('.ember-text-field', 'METAL Mario')
    await selectChoose('.feeling-selector', 'Sad');

    feeling = await model.get('feeling.title');

    assert.equal(model.get('name'), 'METAL Mario', 'metal mario is more metal');
    assert.equal(feeling, 'Sad', 'metal mario is sad');
  });
});
