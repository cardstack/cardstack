import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | card-space/profile-card', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders a Card Space profile with defaults', async function (assert) {
    await render(hbs`
      <CardSpace::ProfileCard
      />
    `);

    assert.dom('[data-test-profile-card-name]').containsText('Name');
    assert
      .dom('[data-test-profile-card-host]')
      .containsText('blank.card.space');
    assert.dom('[data-test-profile-card-category]').containsText('Category');
    assert
      .dom('[data-test-profile-card-description]')
      .containsText('Description');
    assert
      .dom('[data-test-profile-card-button-text]')
      .containsText('Button Text');
    assert
      .dom('[data-test-profile-card]')
      .doesNotContainText(
        'Profile preview',
        'it defaults to not being a preview'
      );
  });

  test('it renders with default overrides', async function (assert) {
    await render(hbs`
      <CardSpace::ProfileCard
        @name='Amazing Emily'
        @host='emily.card.space'
        @category='Health'
        @description='Welcome to a healthy & happy life!'
        @buttonText='Visit this Creator'
        @isPreview={{true}}
      />
    `);

    assert.dom('[data-test-profile-card-name]').containsText('Amazing Emily');
    assert
      .dom('[data-test-profile-card-host]')
      .containsText('emily.card.space');
    assert.dom('[data-test-profile-card-category]').containsText('Health');
    assert
      .dom('[data-test-profile-card-description]')
      .containsText('Welcome to a healthy & happy life!');
    assert
      .dom('[data-test-profile-card-button-text]')
      .containsText('Visit this Creator');
    assert.dom('[data-test-profile-card]').containsText('Profile preview');
  });
});
