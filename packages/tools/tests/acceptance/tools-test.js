import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click, fillIn, triggerEvent, waitFor, settled } from '@ember/test-helpers';
import { login } from '../helpers/login';
import { ciSessionId } from '@cardstack/test-support/environment';
import { hubURL } from '@cardstack/plugin-utils/environment';

let nonce = 0;

// use the main:router location API to get the current URL the currentURL test helper
// is not actually aware of the location
function currentURL(owner) {
  let router = owner.lookup('router:main');
  return router.get('location').getURL();
}

async function getDocuments(type) {
  let url = `${hubURL}/api/${type}`;
  let response = await fetch(url, {
    headers: {
      authorization: `Bearer ${ciSessionId}`,
      "content-type": 'application/vnd.api+json'
    }
  });
  return (await response.json()).data;
}

module('Acceptance | tools', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function() {
    delete localStorage['cardstack-tools'];
  });

  hooks.afterEach(function() {
    delete localStorage['cardstack-tools'];
  });

  test('activating tools on a post page displays header and editor panel', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');

    assert.dom('[data-test-cs-header]').exists();
    assert.dom('[data-test-cs-editor-panel]').exists();
  });

  test('editor main panel can display all field types', async function (assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-cs-collapsible-section=post-1-title]').exists('post-title section exists');
    assert.dom('[data-test-cs-collapsible-section=post-1-title] [data-test-cs-collapsible-section-title]').hasText('Title');
    assert.dom('[data-test-cs-collapsible-section=post-1-title] [data-test-cs-field-editor=title] input').hasValue('10 steps to becoming a fearsome pirate');

    assert.dom('[data-test-cs-collapsible-section=comment-1-body]').exists('comment-body section exists');
    assert.dom('[data-test-cs-collapsible-section=comment-1-body] [data-test-cs-collapsible-section-title]').hasText('Comment #1: Body');
    assert.dom('[data-test-cs-collapsible-section=comment-1-body] [data-test-cs-field-editor=body] input').hasValue('Look behind you, a Three-Headed Monkey!');

    assert.dom('[data-test-cs-collapsible-section=post-1-author-name]').exists('author-name section exists');
    assert.dom('[data-test-cs-collapsible-section=post-1-author-name] [data-test-cs-collapsible-section-title]').hasText('Author Name');
    assert.dom('[data-test-cs-collapsible-section=post-1-author-name] [data-test-cs-field-editor=author-name] input').hasValue('LeChuck');
  });

  test('field groups for related types are rendered correctly', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test=reading-time]').containsText('8 minutes');
    assert.dom('[data-test=karma-0]').containsText('10 Good');
    assert.dom('[data-test=karma-1]').containsText('5 Bad');
  });

  test('show validation error', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    let titleEditor = '[data-test-cs-collapsible-section=post-1-title] [data-test-cs-field-editor=title] input';
    await fillIn(titleEditor, '');
    await triggerEvent(titleEditor, 'blur');
    await waitFor('[data-test-validation-error=title]');
    assert.dom('[data-test-validation-error=title]').hasText('Title must not be empty');

    let commentBodyEditor = '[data-test-cs-collapsible-section=comment-1-body] [data-test-cs-field-editor=body] input';
    await fillIn(commentBodyEditor, '');
    await triggerEvent(commentBodyEditor, 'blur');
    await waitFor('[data-test-validation-error=body]');
    assert.dom('[data-test-validation-error=body]').hasText('Body must not be empty');
  });

  test('show validation error for new resource', async function (assert) {
    await visit('/hub/posts/new');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await click('[data-test-cs-version-control-button-save="false"]');
    await settled();

    assert.dom('[data-test-cs-collapsible-section=post--title]').hasClass('invalid');
    assert.dom('[data-test-validation-error=title]').hasText('Title must not be empty');
  });

  test('show all fields, not just those rendered from template', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-cs-collapsible-section=post-1-archived]').exists("Unrendered field appears in editor");
    assert.dom('[data-test-cs-collapsible-section=post-1-title]').exists({ count: 1 }, "Rendered fields only appear once");
  });

  test('it shows fields in the header section', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-header]');

    assert.dom('[data-test-cs-active-composition-panel-top-fields] [data-test-cs-field-editor="keywords"]').exists();
    assert.dom('[data-test-cs-active-composition-panel-top-fields] [data-test-cs-field-editor="rating"]').exists();
    assert.dom('[data-test-cs-active-composition-panel-top-fields] [data-test-cs-field-editor="created-at"]').exists();
  });

  test('it can hide the title of fields in the header section', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-header]');

    assert.dom('[cs-field-editor-section-title="rating"]').doesNotExist();
    assert.dom('[cs-field-editor-section-title="keywords"]').exists();
  });

  test('fields shown in the header section are not shown in the non-header section (main section)', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-cs-field-editor="rating"]').exists({ count: 1 });
    assert.dom('[data-test-cs-field-editor="keywords"]').exists({ count: 1 });
    assert.dom('[data-test-cs-field-editor="created-at"]').exists({ count: 1 });
  });

  test('it does not collapse sections for right edge input fields that are not rendered in the template when you type in the field', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    let slugInput = '[data-test-cs-collapsible-section=post-1-slug] [data-test-cs-field-editor=slug] input';
    await fillIn(slugInput, 'h');

    assert.dom(slugInput).isVisible();
  });

  test('show unrendered fields from related, owned records', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-cs-collapsible-section=comment-1-review-status] [data-test-cs-collapsible-section-title]').hasText('Comment #1: Review Status');
    assert.dom('[data-test-cs-collapsible-section=comment-2-review-status] [data-test-cs-collapsible-section-title]').hasText('Comment #2: Review Status');
  });


  test('panel captions of field groups are unambiguous', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-cs-collapsible-section=comment-1-body] [data-test-cs-collapsible-section-title]').hasText('Comment #1: Body');
    assert.dom('[data-test-cs-collapsible-section=comment-1-karma] [data-test-cs-collapsible-section-title]').hasText('Comment #1: Karma');
    assert.dom('[data-test-cs-collapsible-section=comment-2-body] [data-test-cs-collapsible-section-title]').hasText('Comment #2: Body');
    assert.dom('[data-test-cs-collapsible-section=comment-2-karma] [data-test-cs-collapsible-section-title]').hasText('Comment #2: Karma');
  });

  test('disable inputs for computed fields', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    let nameInput = '[data-test-cs-collapsible-section=post-1-author-name] [data-test-cs-field-editor=author-name] input';
    assert.dom(nameInput).isDisabled('Computed field is disabled');
  });

  test('allow editing fields for related, owned records', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    let reviewStatusInput = '[data-test-cs-collapsible-section=comment-1-review-status] [data-test-cs-field-editor=review-status] input';
    assert.dom(reviewStatusInput).isNotDisabled();

    reviewStatusInput = '[data-test-cs-collapsible-section=comment-2-review-status] [data-test-cs-field-editor=review-status] input';
    assert.dom(reviewStatusInput).isNotDisabled();
  });

  test('fields with the same name but belonging to a different type are rendered in editor', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');
    assert.dom('[data-test-cs-collapsible-section=category-1-popularity] [data-test-cs-collapsible-section-title]').hasText('Category #1: Popularity');
  });

  test('allow editing fields of newly added, owned records', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    await click('[data-test-cs-collapsible-section=post-1-categories] [data-test-add-category-button]');
    await fillIn('.category-editor:last-of-type > input', 'Pirating');

    let popularityInput = '[data-test-cs-collapsible-section=category-1-popularity] [data-test-cs-field-editor=popularity] input';
    assert.dom(popularityInput).isNotDisabled();
  });

  test('can hide fields from editor', async function (assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-field-name="hidden-field-from-editor"]').doesNotExist();
    assert.dom('[data-test-dummy-hidden-field-from-editor]').hasText('This field is hidden from the editor');
    assert.dom('[data-test-field-name="hidden-computed-field-from-editor"]').doesNotExist();
  });

  test('allow editing fields of newly added record', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    await click('[data-test-cs-create-button]');
    await click('[data-test-cs-create-menu-item=posts] button');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    assert.dom('[data-test-cs-collapsible-section=post--title] [data-test-cs-field-editor=title] input').isNotDisabled();
  });

  test('adding new record updates the query-based relationship', async function(assert) {
    await visit('/hub/catalogs/1');

    assert.dom('.popular-posts .post-embedded').exists({ count: 1 });
    assert.dom('.popular-posts .post-embedded:nth-of-type(1)').hasText('Second Post');
    assert.dom('.top-post .post-embedded').exists({ count: 1 });
    assert.dom('.top-post .post-embedded').hasText('Second Post');

    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-editor-panel]');

    await click('[data-test-cs-create-button]');
    await click('[data-test-cs-create-menu-item="posts"] button');

    let titleInput = '[data-test-cs-collapsible-section=post--title] input';
    await fillIn(titleInput, 'Adventures in Pirating');

    let ratingInput = '[data-test-cs-field-editor="rating"] input';
    await fillIn(ratingInput, 5);

    await click('[data-test-cs-version-control-button-save="false"]');
    await waitFor('[data-test-cs-version-control-button-save="true"]');
    await visit('/hub/catalogs/1');

    assert.dom('.popular-posts .post-embedded').exists({ count: 2 });
    assert.dom('.popular-posts .post-embedded:nth-of-type(1)').hasText('Adventures in Pirating');
    assert.dom('.popular-posts .post-embedded:nth-of-type(2)').hasText('Second Post');
    assert.dom('.top-post .post-embedded').exists({ count: 1 });
    assert.dom('.top-post .post-embedded').hasText('Adventures in Pirating');
  });

  test('header sections strings are editable', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');
    let keywords = '[data-test-cs-field-editor="keywords"] input';
    assert.dom(keywords).isNotDisabled();
  })

  test('saving a new document changes the URL to the canonical path of the saved document', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    await click('[data-test-cs-create-button]');
    await click('[data-test-cs-create-menu-item=posts] button');

    let titleInput = '[data-test-cs-collapsible-section=post--title] input';
    let title = `document ${Date.now()}-${nonce++}`;
    await fillIn(titleInput, title);

    await click('[data-test-cs-version-control-button-save="false"]');
    await waitFor('[data-test-cs-version-control-button-save="true"]');

    let posts = await getDocuments('posts');
    let { type, id } = posts.find(p => p.attributes.title === title);

    assert.equal(currentURL(this.owner), `/hub/${type}/${id}`);
  });

  test('fields can be edited after new document has been saved', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-editor-panel]');

    await click('[data-test-cs-create-button]');
    await click('[data-test-cs-create-menu-item="posts"] button');
    await waitFor('[data-test-cs-active-composition-panel-main]');

    let titleInput = '[data-test-cs-field-editor="title"] input';
    await fillIn(titleInput, 'Title 1');

    await click('[data-test-cs-version-control-button-save="false"]');
    await waitFor('[data-test-cs-version-control-button-save="true"]');

    let keywordField = '[data-test-cs-field-editor="keywords"] input';
    await fillIn(keywordField, 'important');
    assert.dom(keywordField).hasValue('important');

    await fillIn(titleInput, 'Title 2');
    assert.dom(titleInput).hasValue('Title 2');
  });

});
