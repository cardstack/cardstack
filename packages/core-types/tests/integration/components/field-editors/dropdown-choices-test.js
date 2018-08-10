import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, findAll } from '@ember/test-helpers';
import { clickTrigger } from 'ember-power-select/test-support/helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/dropdown choices editor', async function(hooks) {

  let scenario = new Fixtures({
    create(factory) {
      factory.addResource('content-types', 'feelings')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' })
      ]);

      factory.addResource('feelings', '1').withAttributes({ title: 'Happy' });
      factory.addResource('feelings', '2').withAttributes({ title: 'Sad' });
      factory.addResource('feelings', '3').withAttributes({ title: 'Exuberant' });
      factory.addResource('feelings', '4').withAttributes({ title: 'Melancholy' });
    },

    destroy() {
      return [{ type: 'feelings' }];
    }
  });

  scenario.setupTest(hooks);

  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="feeling" enabled=true}}`);

    await clickTrigger();
    assert.equal(findAll('.ember-power-select-option').length, 4, 'Dropdown is rendered');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="feeling" enabled=false}}`);

    await clickTrigger();
    assert.notOk(findAll('.ember-power-select-option').length, 'Dropdown is disabled');
  });
});
