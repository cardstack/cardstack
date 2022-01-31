import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';
import { CARD_EDIT_MODAL_STATES } from '@cardstack/web-client/components/card-space/user-page/card-edit-modal';

const CARD_CONTAINER = '[data-test-card-space-card-container]';
const CARD_CONTAINER_HEADER = '[data-test-card-space-card-container-header]';
const CARD_CONTAINER_EDIT_BUTTON =
  '[data-test-card-space-card-container-edit-button]';
const CARD_CONTAINER_HEADER_EDIT_BUTTON =
  '[data-test-card-space-card-container-header-edit-button]';
const CARD_CONTAINER_BODY = '[data-test-card-space-card-container-body]';
const CARD_CONTAINER_EDIT_COMPONENT = '[data-test-card-space-card-edit-modal]';
const CARD_CONTAINER_EDIT_COMPONENT_HEADER =
  '[data-test-card-space-card-edit-modal] [data-test-boxel-header]';
const CARD_CONTAINER_EDIT_COMPONENT_TITLE =
  '[data-test-card-space-card-edit-modal-title]';

module(
  'Integration | Component | card-space/user-page/card-container',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.setProperties({
        editable: false,
        sufficientContent: false,
        header: 'Test Header',
        onClickEdit: () => {},
      });
    });

    test('it does not render its view-only state when there is not sufficient content', async function (assert) {
      this.set('editable', false);
      this.set('sufficientContent', false);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
        </CardSpace::UserPage::CardContainer>
      `);
      assert.dom(CARD_CONTAINER).doesNotExist();
    });

    test('it renders its view-only state', async function (assert) {
      this.set('editable', false);
      this.set('sufficientContent', true);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
        </CardSpace::UserPage::CardContainer>
      `);

      assert.dom(CARD_CONTAINER).exists();
      assert.dom(CARD_CONTAINER_HEADER).doesNotExist();
      assert.dom(CARD_CONTAINER_BODY).containsText('Default content');
      assert.dom(CARD_CONTAINER_EDIT_BUTTON).doesNotExist();
    });
    test('it renders its editable state', async function (assert) {
      this.set('editable', true);
      this.set('sufficientContent', true);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
        </CardSpace::UserPage::CardContainer>
      `);

      assert.dom(CARD_CONTAINER_HEADER).exists();
      assert.dom(CARD_CONTAINER_EDIT_BUTTON).isVisible();
      assert.dom(CARD_CONTAINER_BODY).containsText('Default content');
    });
    test('it renders placeholders in its editable state when there is not sufficient content', async function (assert) {
      this.set('editable', true);
      this.set('sufficientContent', false);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
        </CardSpace::UserPage::CardContainer>
      `);

      assert.dom(CARD_CONTAINER_BODY).containsText('Placeholder content');
      assert.dom(CARD_CONTAINER_EDIT_BUTTON).isVisible();
    });
    test('it renders default content in its editable state when there is no placeholder named block, even without sufficient content', async function (assert) {
      this.set('editable', true);
      this.set('sufficientContent', false);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
        </CardSpace::UserPage::CardContainer>
      `);

      assert.dom(CARD_CONTAINER_BODY).containsText('Default content');
    });
    test('its edit-button block provides an edit button', async function (assert) {
      this.set('editable', true);
      this.set('sufficientContent', true);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
          <:edit-button as |EditButton|>
            <EditButton>
              Here is a custom edit button
            </EditButton>
          </:edit-button>
        </CardSpace::UserPage::CardContainer>
      `);

      assert
        .dom(CARD_CONTAINER_EDIT_BUTTON)
        .containsText('Here is a custom edit button');
    });
    test('its edit buttons trigger the onClickEdit action', async function (assert) {
      let onClickEditSpy = sinon.spy();

      this.set('editable', true);
      this.set('sufficientContent', true);
      this.set('onClickEdit', onClickEditSpy);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
          <:edit as |EditComponent|>
            <EditComponent>
              Edit content
            </EditComponent>
          </:edit>
        </CardSpace::UserPage::CardContainer>
      `);

      assert.ok(onClickEditSpy.notCalled);
      await click(CARD_CONTAINER_EDIT_BUTTON);
      assert.ok(onClickEditSpy.calledOnce);

      await click(CARD_CONTAINER_HEADER_EDIT_BUTTON);
      assert.ok(onClickEditSpy.calledTwice);
    });
    test('its edit block provides a card edit modal that is closed and uses its header + title', async function (assert) {
      this.set('editComponentState', undefined);
      this.set('editable', true);

      await render(hbs`
        <CardSpace::UserPage::CardContainer
          @editable={{this.editable}}
          @sufficientContent={{this.sufficientContent}}
          @header={{this.header}}
          @onClickEdit={{this.onClickEdit}}
        >
          <:default>
            Default content
          </:default>
          <:placeholder>
            Placeholder content
          </:placeholder>
          <:edit as |EditComponent|>
            <EditComponent
              @state={{this.editComponentState}}
            >
              Editing content
            </EditComponent>
          </:edit>
        </CardSpace::UserPage::CardContainer>
      `);

      assert.dom(CARD_CONTAINER_EDIT_COMPONENT).doesNotExist();

      this.set('editComponentState', CARD_EDIT_MODAL_STATES.EDITING);

      assert.dom(CARD_CONTAINER_EDIT_COMPONENT).exists();
      assert
        .dom(CARD_CONTAINER_EDIT_COMPONENT_HEADER)
        .containsText('Test Header');
      assert
        .dom(CARD_CONTAINER_EDIT_COMPONENT_TITLE)
        .containsText('Test Header');
      assert.dom(CARD_CONTAINER_EDIT_COMPONENT).containsText('Editing content');
    });
  }
);
