import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';
import { CARD_EDIT_MODAL_STATES } from '@cardstack/web-client/components/card-space/user-page/card-edit-modal';

const LAYOUT_CARD_CONTAINER = '[data-test-card-space-layout-card-container]';
const LAYOUT_CARD_CONTAINER_HEADER =
  '[data-test-card-space-layout-card-container-header]';
const LAYOUT_CARD_CONTAINER_EDIT_BUTTON =
  '[data-test-card-space-layout-card-container-edit-button]';
const LAYOUT_CARD_CONTAINER_HEADER_EDIT_BUTTON =
  '[data-test-card-space-layout-card-container-header-edit-button]';
const LAYOUT_CARD_CONTAINER_EDIT_COMPONENT =
  '[data-test-card-space-card-edit-modal]';
const LAYOUT_CARD_CONTAINER_EDIT_COMPONENT_HEADER =
  '[data-test-card-space-card-edit-modal] [data-test-boxel-header]';
const LAYOUT_CARD_CONTAINER_EDIT_COMPONENT_TITLE =
  '[data-test-card-space-card-edit-modal-title]';

module(
  'Integration | Component | card-space/user-page/layout-card-container',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.setProperties({
        editable: false,
        header: 'Test Header',
        onClickEdit: () => {},
      });
    });

    test('it renders its view-only state', async function (assert) {
      this.set('editable', false);

      await render(hbs`
        <CardSpace::UserPage::LayoutCardContainer
          @editable={{this.editable}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
        </CardSpace::UserPage::LayoutCardContainer>
      `);

      assert.dom(LAYOUT_CARD_CONTAINER).exists();
      assert.dom(LAYOUT_CARD_CONTAINER_HEADER).doesNotExist();
      assert.dom(LAYOUT_CARD_CONTAINER).containsText('Default content');
      assert.dom(LAYOUT_CARD_CONTAINER_EDIT_BUTTON).doesNotExist();
    });
    test('it renders its editable state', async function (assert) {
      this.set('editable', true);

      await render(hbs`
        <CardSpace::UserPage::LayoutCardContainer
          @editable={{this.editable}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
        </CardSpace::UserPage::LayoutCardContainer>
      `);

      assert.dom(LAYOUT_CARD_CONTAINER_HEADER).exists();
      assert.dom(LAYOUT_CARD_CONTAINER).containsText('Default content');
    });
    test('its default block provides an edit button', async function (assert) {
      this.set('editable', true);

      await render(hbs`
        <CardSpace::UserPage::LayoutCardContainer
          @editable={{this.editable}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default as |EditButton|>
            Default content
            <EditButton>
              test edit button
            </EditButton>
          </:default>
          <:edit as |EditComponent|>
            <EditComponent>
              Editing content
            </EditComponent>
          </:edit>
        </CardSpace::UserPage::LayoutCardContainer>
      `);

      assert
        .dom(LAYOUT_CARD_CONTAINER_EDIT_BUTTON)
        .containsText('test edit button');
      this.set('editable', false);
      assert.dom(LAYOUT_CARD_CONTAINER_EDIT_BUTTON).doesNotExist();
    });
    test('its edit button(s) trigger the onClickEdit action', async function (assert) {
      let onClickEditSpy = sinon.spy();
      this.set('editable', true);
      this.set('onClickEdit', onClickEditSpy);

      await render(hbs`
        <CardSpace::UserPage::LayoutCardContainer
          @editable={{this.editable}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default as |EditButton|>
            Default content
            <EditButton>
              test edit button
            </EditButton>
          </:default>
          <:edit as |EditComponent|>
            <EditComponent>
              Editing content
            </EditComponent>
          </:edit>
        </CardSpace::UserPage::LayoutCardContainer>
      `);

      assert.ok(onClickEditSpy.notCalled);
      await click(LAYOUT_CARD_CONTAINER_EDIT_BUTTON);
      assert.ok(onClickEditSpy.calledOnce);

      await click(LAYOUT_CARD_CONTAINER_HEADER_EDIT_BUTTON);
      assert.ok(onClickEditSpy.calledTwice);
    });
    test('its edit block provides a card edit modal that is closed and uses its header + title', async function (assert) {
      this.set('editable', true);

      await render(hbs`
        <CardSpace::UserPage::LayoutCardContainer
          @editable={{this.editable}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default as |EditButton|>
            Default content
            <EditButton>
              test edit button
            </EditButton>
          </:default>
          <:edit as |EditComponent|>
            <EditComponent
              @state={{this.editComponentState}}
            >
              Editing content
            </EditComponent>
          </:edit>
        </CardSpace::UserPage::LayoutCardContainer>
      `);

      assert.dom(LAYOUT_CARD_CONTAINER_EDIT_COMPONENT).doesNotExist();

      this.set('editComponentState', CARD_EDIT_MODAL_STATES.EDITING);

      assert.dom(LAYOUT_CARD_CONTAINER_EDIT_COMPONENT).exists();
      assert
        .dom(LAYOUT_CARD_CONTAINER_EDIT_COMPONENT_HEADER)
        .containsText('Test Header');
      assert
        .dom(LAYOUT_CARD_CONTAINER_EDIT_COMPONENT_TITLE)
        .containsText('Test Header');
      assert
        .dom(LAYOUT_CARD_CONTAINER_EDIT_COMPONENT)
        .containsText('Editing content');
    });
  }
);
