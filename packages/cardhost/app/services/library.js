import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import { canonicalURL } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const catalogEntry = Object.freeze({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
// TODO need to think through pagination on the library page...
const size = 100;

export default class LibraryService extends Service {
  @service data;

  @tracked visible = false;
  @tracked recentCards;
  @tracked templateEntries;
  @tracked featuredEntries;

  constructor(...args) {
    super(...args);

    this.load.perform();
  }

  @task(function*() {
    let [recentCards, templateEntries, featuredEntries] = yield Promise.all([
      this.data.search(
        {
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
            not: {
              eq: {
                csAdoptsFrom: canonicalURL(catalogEntry),
              },
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      ),
      this.data.search(
        {
          filter: {
            type: catalogEntry,
            eq: {
              type: 'template',
            },
          },
          // Note that we are sorting these items on the date the catalog entry
          // was created, not on the date that the underlying card was created
          // (which is simple to change if that's what we want).
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      ),
      this.data.search(
        {
          filter: {
            type: catalogEntry,
            eq: {
              type: 'featured',
            },
          },
          // Note that we are sorting these items on the date the catalog entry
          // was created, not on the date that the underlying card was created
          // (which is simple to change if that's what we want).
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'isolated' }
      ),
    ]);
    this.recentCards = recentCards;
    this.templateEntries = templateEntries;
    this.featuredEntries = featuredEntries;
  })
  load;

  @action
  show() {
    this.visible = true;
  }

  @action
  hide() {
    this.visible = false;
  }
}
