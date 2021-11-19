import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const TEST_COLUMN_ATTRIBUTE = 'data-test-boxel-sort-menu-item-column';
const TEST_DIRECTION_ATTRIBUTE = 'data-test-boxel-sort-menu-item-direction';
const ASCENDING_NUMERIC_REGEX = /1\s+9/;
const DESCENDING_NUMERIC_REGEX = /9\s+1/;
const ASCENDING_ALPHABETICAL_REGEX = /A\s+Z/;
const DESCENDING_ALPHABETICAL_REGEX = /Z\s+A/;

module('Integration | Component | SortMenu', function (hooks) {
  setupRenderingTest(hooks);

  test('It renders numeric items as an ascending-descending pair', async function (assert) {
    this.set('columns', [{ name: 'Year', sortType: 'numeric' }]);
    await render(
      hbs`<Boxel::SortMenu @onSort={{(noop)}} @sortableColumns={{this.columns}}/>`
    );
    assert
      .dom(
        `[${TEST_COLUMN_ATTRIBUTE}='Year'][${TEST_DIRECTION_ATTRIBUTE}='asc']`
      )
      .exists()
      .includesText('Year')
      .hasText(ASCENDING_NUMERIC_REGEX);
    assert
      .dom(
        `[${TEST_COLUMN_ATTRIBUTE}='Year'][${TEST_DIRECTION_ATTRIBUTE}='desc']`
      )
      .exists()
      .includesText('Year')
      .hasText(DESCENDING_NUMERIC_REGEX);

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('It renders alphabetical items as an ascending-descending pair', async function (assert) {
    this.set('columns', [{ name: 'Title', sortType: 'alpha' }]);
    await render(
      hbs`<Boxel::SortMenu @onSort={{(noop)}} @sortableColumns={{this.columns}}/>`
    );
    assert
      .dom(
        `[${TEST_COLUMN_ATTRIBUTE}='Title'][${TEST_DIRECTION_ATTRIBUTE}='asc']`
      )
      .exists()
      .includesText('Title')
      .hasText(ASCENDING_ALPHABETICAL_REGEX);
    assert
      .dom(
        `[${TEST_COLUMN_ATTRIBUTE}='Title'][${TEST_DIRECTION_ATTRIBUTE}='desc']`
      )
      .exists()
      .includesText('Title')
      .hasText(DESCENDING_ALPHABETICAL_REGEX);
  });

  test('It applies appropriate classes to the selected sort', async function (assert) {
    const columns = [{ name: 'Title', sortType: 'alpha' }];
    this.set('sortableColumns', columns);
    this.set('sortedColumn', columns[0]);
    this.set('sortedDirection', 'asc');
    await render(
      hbs`<Boxel::SortMenu @onSort={{(noop)}} @sortableColumns={{this.sortableColumns}} @sortedColumn={{this.sortedColumn}} @sortedDirection={{this.sortedDirection}}/>`
    );

    assert
      .dom(
        `[${TEST_DIRECTION_ATTRIBUTE}='asc'][${TEST_COLUMN_ATTRIBUTE}='Title']`
      )
      .hasClass(/__active/);
  });

  test('It calls the callback with the appropriate arguments on click', async function (assert) {
    const yearColumn = { name: 'Year', sortType: 'numeric' };
    const titleColumn = { name: 'Title', sortType: 'alpha' };
    const columns = [titleColumn, yearColumn];
    const currentSelection = {
      sortedColumn: titleColumn,
      direction: 'asc',
    };

    this.set('sortableColumns', columns);
    this.set('sortedColumn', currentSelection.sortedColumn);
    this.set('sortedDirection', currentSelection.direction);
    this.set('onSort', (column, direction) => {
      currentSelection.sortedColumn = column;
      currentSelection.direction = direction;
      this.set('sortedColumn', column);
      this.set('sortedDirection', direction);
    });

    await render(
      hbs`<Boxel::SortMenu @onSort={{fn this.onSort}} @sortableColumns={{this.sortableColumns}} @sortedColumn={{this.sortedColumn}} @sortedDirection={{this.sortedDirection}}/>`
    );

    await click(
      `[${TEST_DIRECTION_ATTRIBUTE}='asc'][${TEST_COLUMN_ATTRIBUTE}='Year']`
    );
    assert.equal(currentSelection.direction, 'asc');
    assert.equal(currentSelection.sortedColumn, yearColumn);
    assert
      .dom(
        `[${TEST_DIRECTION_ATTRIBUTE}='asc'][${TEST_COLUMN_ATTRIBUTE}='Year']`
      )
      .hasClass(/__active/);

    await click(
      `[${TEST_DIRECTION_ATTRIBUTE}='desc'][${TEST_COLUMN_ATTRIBUTE}='Title']`
    );
    assert.equal(currentSelection.direction, 'desc');
    assert.equal(currentSelection.sortedColumn, titleColumn);
    assert
      .dom(
        `[${TEST_DIRECTION_ATTRIBUTE}='desc'][${TEST_COLUMN_ATTRIBUTE}='Title']`
      )
      .hasClass(/__active/);
  });
});
