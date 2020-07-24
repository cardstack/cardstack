import Route from '@ember/routing/route';
import { dasherize } from '@ember/string';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryCollectionRoute extends Route {
  async model({ collectionId }) {
    const records = await fetchCollection('all_tracks_combined');
    let tracks = records.filter(item => {
      if (item.catalog) {
        return item.catalog.map(catalog => {
          let catalogId = dasherize(catalog.trim());
          return catalogId === collectionId;
        }).includes(true);
      }
    });
    return {
      title: collectionId,
      type: 'collection',
      collection: tracks,
      itemType: 'masters',
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
          valuePath: 'song_title',
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
