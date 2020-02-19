import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import Service from '@ember/service';
import Fixtures from '../../helpers/fixtures';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';

import hbs from 'htmlbars-inline-precompile';
const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;

const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'millenial-puppies',
  title: 'The Millenial Puppy',
});
const scenario = new Fixtures({
  create: [testCard],
});

module('Integration | Component | save-button', function(hooks) {
  setupRenderingTest(hooks);
  scenario.setupTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<SaveButton />`);

    assert.equal(this.element.textContent.trim(), 'Saved');
  });

  test('can change click action', async function(assert) {
    assert.expect(1);

    let service = this.owner.lookup('service:data');
    let card = await service.load(testCard, 'everything');
    this.owner.register(
      'service:cardstack-session',
      Service.extend({
        isAuthenticated: true,
      })
    );
    this.set('card', { card });
    this.set('updateCard', () => {});
    this.set('clickAction', () => {
      assert.ok(true);
    });

    await render(
      hbs`<SaveButton @card={{this.card}} @clickAction={{this.clickAction}} @updateCard={{this.updateCard}}/>`
    );

    await click('[data-test-card-save-btn]');
  });

  test('autosaves when card is dirty', async function(assert) {
    assert.expect(1);

    let service = this.owner.lookup('service:data');
    let card = await service.load(testCard, 'everything');
    let model = { isDirty: false };
    this.owner.register(
      'service:cardstack-session',
      Service.extend({
        isAuthenticated: true,
      })
    );
    this.set('card', card);
    this.set('model', model);
    this.set('updateCard', () => {});
    this.set('clickAction', () => {
      assert.ok(true);
    });

    await render(
      hbs`<SaveButton @isDirty={{this.model.isDirty}} @card={{this.card}} @clickAction={{this.clickAction}} @autosaveDisabled={{false}}/>`
    );

    this.set('model.isDirty', true);
    this.set('card', await card.patch((await card.asUpstreamDoc()).jsonapi));

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('can disable autosave', async function(assert) {
    assert.expect(0);

    let service = this.owner.lookup('service:data');
    let card = await service.load(testCard, 'everything');
    let model = { isDirty: false };
    this.owner.register(
      'service:cardstack-session',
      Service.extend({
        isAuthenticated: true,
      })
    );
    this.set('card', card);
    this.set('model', model);
    this.set('updateCard', () => {});
    this.set('clickAction', () => {
      assert.ok(true);
    });

    await render(
      hbs`<SaveButton @card={{this.card}} @clickAction={{this.clickAction}} @autosaveDisabled={{true}} @updateCard={{this.updateCard}} @isDirty={{this.model.isDirty}}/>`
    );

    this.set('model.isDirty', true);
    this.set('card', await card.patch((await card.asUpstreamDoc()).jsonapi));

    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});
