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

    assert.dom('[data-test-profile-card-placeholder-cover-photo]').exists();
    assert.dom('[data-test-profile-card-placeholder-profile-photo]').exists();

    assert.dom('[data-test-profile-card-name]').containsText('Name');
    assert
      .dom('[data-test-profile-card-host]')
      .containsText('blank.pouty.pizza');
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
        @coverPhoto='/images/prepaid-card-customizations/pattern-4.svg'
        @profilePhoto='/images/logos/metamask-logo.svg'
        @isPreview={{true}}
      />
    `);

    assert
      .dom('[data-test-profile-card-placeholder-cover-photo]')
      .doesNotExist();
    assert
      .dom('[data-test-profile-card-cover-photo] img')
      .hasAttribute('src', '/images/prepaid-card-customizations/pattern-4.svg');

    assert
      .dom('[data-test-profile-card-placeholder-profile-photo]')
      .doesNotExist();
    assert
      .dom('[data-test-profile-card-profile-photo] img')
      .hasAttribute('src', '/images/logos/metamask-logo.svg');

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
    assert.dom('[data-test-profile-card]').containsText('Preview');
  });
});
