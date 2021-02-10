import MediaRegistryController from '../media-registry';
import { tracked } from '@glimmer/tracking';
import { action, set, get } from '@ember/object';
import { compare, isBlank } from '@ember/utils';
import { fetchCollection } from 'dummy/media';
import { formatId } from 'dummy/utils/format-id';
import sunlightCoverThumb from 'dummy/images/media-registry/covers/thumb/Sunlight.jpg';
import changeIsGoodCoverThumb from 'dummy/images/media-registry/covers/thumb/Change-Is-Good.jpg';
import fullMoonCoverThumb from 'dummy/images/media-registry/covers/thumb/Full-Moon.jpg';
import loveNeverDiesCoverThumb from 'dummy/images/media-registry/covers/thumb/Love-Never-Dies.jpg';
import animalsCoverThumb from 'dummy/images/media-registry/covers/thumb/Animals.jpg';
export default class MediaRegistryCardflowController extends MediaRegistryController {
  @tracked isolatedCollection = this.getIsolatedCollection(this.catalog.id);
  @tracked currentMilestone = this.model.currentOrg.queueCards
    ? this.milestones.filter(
        (el) => el.pct === this.model.currentOrg.queueCards[0].progressPct
      )[0]
    : null;
  @tracked displayCatalogModal = false;
  @tracked displayItemModal = false;
  @tracked record = null;

  catalog = {
    id: 'batch-f',
    type: 'catalog',
    title: 'Batch F',
    count: '16',
    selected_art: [
      sunlightCoverThumb,
      changeIsGoodCoverThumb,
      fullMoonCoverThumb,
      loveNeverDiesCoverThumb,
      animalsCoverThumb,
    ],
  };

  get projectTitle() {
    return this.model.currentOrg.queueCards[0].title;
  }

  @action
  updateProgress(val) {
    if (!val) {
      this.currentMilestone = this.milestones[0];
    }
    this.currentMilestone = this.milestones.filter((el) => {
      if (el.pct === val) {
        set(el, 'current', true);
        return el;
      } else {
        set(el, 'current', false);
      }
    })[0];
  }

  @action
  mockStep(val) {
    if (
      val.id === 'crd_records' &&
      (!this.currentMilestone || this.currentMilestone.pct < 40)
    ) {
      this.updateProgress(40);
    } else {
      return;
    }
  }

  @action
  transition(val) {
    let { currentRouteName } = this.target;
    this.mockStep(val);

    if (this.model.id !== val.id) {
      if (
        currentRouteName === 'media-registry.agreements' ||
        currentRouteName === 'media-registry.cardflow'
      ) {
        return this.transitionToRoute(currentRouteName, val.id);
      }
    }

    this.transitionToRoute('media-registry', val.id);
  }

  @action
  async getIsolatedCollection(collectionId) {
    const records = await fetchCollection('all_tracks_combined');
    let tracks = records.filter((item) => {
      if (item.collection_ids) {
        return item.collection_ids.includes(collectionId);
      }
    });

    this.isolatedCollection = {
      id: collectionId,
      title: collectionId,
      type: 'collection',
      collection: tracks,
      itemType: 'master',
      itemTypePlural: 'masters',
      itemComponent: 'cards/master-collection-item',
      listFields: [
        {
          name: 'Release Title',
          valuePath: 'album',
        },
        {
          name: 'Release Type',
          valuePath: 'type_of_album',
        },
        {
          name: 'Genre',
          valuePath: 'genre',
        },
        {
          name: 'Length',
          valuePath: 'length',
        },
      ],
      columns: [
        {
          name: 'Title',
          valuePath: 'title',
          isFixed: 'left',
          width: 350,
        },
        {
          name: 'Artist',
          valuePath: 'artist',
          width: 250,
        },
        {
          name: 'Release Title',
          valuePath: 'album',
          width: 250,
        },
        {
          name: 'Artwork',
          valuePath: 'cover_art',
          width: 175,
          isSortable: false,
        },
        {
          name: 'Release Type',
          valuePath: 'type_of_album',
          width: 250,
        },
        {
          name: 'Genre',
          valuePath: 'genre',
          width: 250,
        },
        {
          name: 'Length',
          valuePath: 'length',
          width: 250,
          sortType: 'numeric',
        },
        {
          width: 0,
          isFixed: 'right',
          isSortable: false,
        },
      ],
    };
  }

  @action
  async getRecord(itemId) {
    if (!itemId) {
      return;
    }

    const records = await fetchCollection('all_tracks_combined');
    const profiles = await fetchCollection('profiles');
    const musicalWorks = await fetchCollection('musical-works');

    const record = records.find((item) => item.id === itemId);
    if (!record) {
      return;
    }

    if (record.collection_ids) {
      const collections = this.model.collection;
      const catalogs = collections.filter((el) =>
        record.collection_ids.includes(el.id)
      );
      record.collections = catalogs;
    }

    if (record.artist_id) {
      const artists = profiles.filter((el) => el.id === record.artist_id);
      record.artists = artists;
    }

    if (record.producer_id) {
      const producers = profiles.filter((el) => el.id === record.producer_id);
      record.producers = producers;
    }

    if (record.iswc_id) {
      const work = musicalWorks.find((el) => el.iswc === record.iswc_id);
      record.musicalWork = work;
    }

    this.record = record;
  }

  get album() {
    if (!this.record || !this.record.album) {
      return null;
    }
    return {
      type: this.record.type_of_album,
      title: this.record.album,
      imgURL: this.record.cover_art_thumb,
      fields: [
        {
          title: 'primary artist',
          value: this.record.artist,
        },
        {
          title: 'label',
          value: this.record.owner,
        },
      ],
    };
  }

  @action
  transitionToProduct() {
    this.transitionToRoute(
      'media-registry.products.album',
      formatId(this.record.album)
    );
  }

  @action
  transitionToCatalog(id) {
    this.transitionToRoute('media-registry.collection', id);
  }

  @action
  expandAction(item) {
    if (item && item.id) {
      this.getRecord(item.id);
      this.displayItemModal = true;
      return;
    }
    this.displayItemModal = false;
  }

  @action
  displayCatalog() {
    this.displayCatalogModal = true;
  }

  @action
  closeModal() {
    this.displayCatalogModal = false;
    this.closeItem();
  }

  @action
  closeItem() {
    this.displayItemModal = false;
  }

  @action
  async search(query) {
    let isolatedCollection = this.isolatedCollection;
    if (
      !isolatedCollection ||
      !isolatedCollection.collection ||
      !isolatedCollection.columns
    ) {
      return;
    }

    let { collection, columns } = this.isolatedCollection;
    if (isBlank(query)) {
      return collection;
    } else {
      let lowerQuery = query.toLowerCase();
      return collection.filter((i) =>
        columns.some(
          (c) =>
            c.isSearchable !== false &&
            c.valuePath &&
            !isBlank(i[c.valuePath]) &&
            String(i[c.valuePath]).toLowerCase().includes(lowerQuery)
        )
      );
    }
  }

  @action
  async sort(column, direction) {
    let isolatedCollection = this.isolatedCollection;
    if (
      !isolatedCollection ||
      !isolatedCollection.collection ||
      !isolatedCollection.columns
    ) {
      return;
    }

    let multiplier = direction === 'asc' ? 1 : -1;
    return this.isolatedCollection.collection.sort(
      (a, b) =>
        multiplier * compare(get(a, column.valuePath), get(b, column.valuePath))
    );
  }
}
