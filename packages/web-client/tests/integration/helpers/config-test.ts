import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, setupOnerror } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import config from '@cardstack/web-client/config/environment';

module('Integration | Helper | config', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders a config value to the template', async function (assert) {
    await render(
      hbs`<span data-test-container>hello {{config 'environment'}}</span>`
    );
    assert.dom('[data-test-container]').containsText(config.environment);
  });

  test('it errors when an unknown config value is requested', async function (assert) {
    setupOnerror(function (err: Error) {
      assert.equal(err.message, 'Unknown config property: urls.unknown');
    });

    render(
      hbs`<span data-test-container>hello {{config 'urls.unknown'}}</span>`
    );
  });
});
