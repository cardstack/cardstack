import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { CARD_EDIT_MODAL_STATES } from '@cardstack/web-client/components/card-space/user-page/card-edit-modal';
import sinon from 'sinon';

const CARD_EDIT_MODAL = '[data-test-card-space-card-edit-modal]';
const CARD_EDIT_MODAL_HEADER =
  '[data-test-card-space-card-edit-modal] [data-test-boxel-header]';
const CARD_EDIT_MODAL_TITLE = '[data-test-card-space-card-edit-modal-title]';
const CARD_EDIT_MODAL_SAVE_BUTTON =
  '[data-test-card-space-card-edit-modal-save-button]';
const CARD_EDIT_MODAL_CANCEL_BUTTON =
  '[data-test-card-space-card-edit-modal-cancel-button]';
const CARD_EDIT_MODAL_BODY = '[data-test-card-space-card-edit-modal-body]';
const OUTSIDE_CARD_EDIT_MODAL = '[data-test-modal-close-via-overlay]';

module(
  'Integration | Component | card-space/user-page/card-edit-modal',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.setProperties({
        state: CARD_EDIT_MODAL_STATES.CLOSED,
        disabled: false,
        header: 'Test Header',
        title: 'Test Title',
        size: 'medium',
        save: () => {},
        close: () => {},
      });
    });

    test('it does not render anything in its CLOSED state', async function (assert) {
      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
      </CardSpace::UserPage::CardEditModal>
    `);

      assert.dom(CARD_EDIT_MODAL).doesNotExist();
    });

    test('it renders content in its EDITING state.', async function (assert) {
      this.set('state', CARD_EDIT_MODAL_STATES.EDITING);
      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
      </CardSpace::UserPage::CardEditModal>
    `);
      assert.dom(CARD_EDIT_MODAL).exists();
      assert.dom(CARD_EDIT_MODAL_HEADER).containsText('Test Header');
      assert.dom(CARD_EDIT_MODAL_TITLE).containsText('Test Title');
      assert.dom(CARD_EDIT_MODAL_BODY).containsText("Here's some content!");
      assert.dom(CARD_EDIT_MODAL_SAVE_BUTTON).containsText('Save').isEnabled();
      assert
        .dom(CARD_EDIT_MODAL_CANCEL_BUTTON)
        .containsText('Cancel')
        .isEnabled();
    });

    test('it allows submitting or canceling in its EDITING state.', async function (assert) {
      let saveSpy = sinon.spy();
      let cancelSpy = sinon.spy();

      this.set('state', CARD_EDIT_MODAL_STATES.EDITING);
      this.set('save', saveSpy);
      this.set('close', cancelSpy);

      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
      </CardSpace::UserPage::CardEditModal>
    `);

      assert.ok(saveSpy.notCalled);
      await click(CARD_EDIT_MODAL_SAVE_BUTTON);
      assert.ok(saveSpy.calledOnce);

      assert.ok(cancelSpy.notCalled);
      await click(CARD_EDIT_MODAL_CANCEL_BUTTON);
      assert.ok(cancelSpy.calledOnce);
    });
    test('if disabled, it does not allow submitting in its EDITING state.', async function (assert) {
      let cancelSpy = sinon.spy();

      this.set('state', CARD_EDIT_MODAL_STATES.EDITING);
      this.set('disabled', true);
      this.set('close', cancelSpy);

      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
      </CardSpace::UserPage::CardEditModal>
    `);

      assert.dom(CARD_EDIT_MODAL_SAVE_BUTTON).isDisabled();

      assert.ok(cancelSpy.notCalled);
      await click(CARD_EDIT_MODAL_CANCEL_BUTTON);
      assert.ok(cancelSpy.calledOnce);
    });
    test('it appears to be loading, and closing or saving is not possible in its SUBMITTING state', async function (assert) {
      let saveSpy = sinon.spy();
      let cancelSpy = sinon.spy();

      this.set('state', CARD_EDIT_MODAL_STATES.SUBMITTING);
      this.set('save', saveSpy);
      this.set('close', cancelSpy);

      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
      </CardSpace::UserPage::CardEditModal>
    `);

      assert.ok(saveSpy.notCalled);
      assert.dom(CARD_EDIT_MODAL_SAVE_BUTTON).hasClass(/--loading/);
      await click(CARD_EDIT_MODAL_SAVE_BUTTON);
      assert.ok(saveSpy.notCalled);

      assert.dom(CARD_EDIT_MODAL_CANCEL_BUTTON).doesNotExist();

      // attempt to click outside to close
      await click(OUTSIDE_CARD_EDIT_MODAL);
      assert.ok(cancelSpy.notCalled);
    });
    test('it allows specifying an error message', async function (assert) {
      this.set('state', CARD_EDIT_MODAL_STATES.EDITING);
      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
        <:error as |ErrorMessage|>
          <ErrorMessage data-test-card-edit-modal-test-error>
            Here is an error message
          </ErrorMessage>
        </:error>
      </CardSpace::UserPage::CardEditModal>
    `);

      assert
        .dom('[data-test-card-edit-modal-test-error]')
        .containsText('Here is an error message');
    });
    test('it can render different sizes', async function (assert) {
      this.set('state', CARD_EDIT_MODAL_STATES.EDITING);

      await render(hbs`
      <CardSpace::UserPage::CardEditModal
        @state={{this.state}}
        @disabled={{this.disabled}}
        @header={{this.header}}
        @title={{this.title}}
        @size={{this.size}}
        @save={{this.save}}
        @close={{this.close}}
      >
        <:default>
          Here's some content!
        </:default>
      </CardSpace::UserPage::CardEditModal>
    `);

      assert.dom('.boxel-modal--medium').exists();

      this.set('size', 'large');

      assert.dom('.boxel-modal--medium').doesNotExist();
      assert.dom('.boxel-modal--large').exists();
    });
  }
);
