import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';
import { titleize } from '@cardstack/boxel/utils/titleize';

export default class MediaRegistryCollectionRoute extends Route {
  titleToken(model) {
    return `${titleize(model.title)} - Master Recordings`;
  }

  async model({ collectionId }) {
    let { currentOrg, orgs } = this.modelFor('media-registry');
    const records = await fetchCollection('all_tracks_combined');
    let tracks = records.filter(item => {
      if (item.collection_ids) {
        return item.collection_ids.includes(collectionId);
      }
    });

    return {
      id: collectionId,
      currentOrg,
      orgs,
      title: collectionId,
      type: 'collection',
      collection: tracks,
      itemType: 'master',
      itemTypePlural: 'masters',
      itemComponent: 'cards/master-collection-item',
      route: 'media-registry.item',
      listFields: [
        {
          name: 'Release Title',
          valuePath: 'album'
        },
        {
          name: 'Release Type',
          valuePath: 'type_of_album'
        },
        {
          name: 'Genre',
          valuePath: 'genre'
        },
        {
          name: 'Length',
          valuePath: 'length'
        },
      ],
      columns: [
        {
          name: 'Title',
          valuePath: 'title',
          isFixed: 'left',
          width: 350
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
          sortType: 'numeric'
        },
        {
          width: 0,
          isFixed: 'right'
        },
      ],
    };
  }
}
