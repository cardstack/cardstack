import Route from '@ember/routing/route';
import fetch from 'fetch';
import { dasherize } from '@ember/string';

const MASTER_TRACKS = '/media-registry/api/bunny_records_tracks.json';

export default class MediaRegistryCollectionRoute extends Route {
  async model({ collectionId }) {
    const data = await fetch(MASTER_TRACKS);
    const records = await data.json();
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
      columns: [
        {
          name: 'Song Title',
          valuePath: 'song_title',
          isFixed: 'left',
          width: 250,
        },
        {
          name: 'Artist',
          valuePath: 'artist',
          width: 250,
        },
        {
          name: 'Album',
          valuePath: 'album',
          width: 250,
        },
        {
          name: 'Artwork',
          valuePath: 'cover_art',
          width: 250,
        },
        {
          name: 'Type of Album',
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
        },
        {
          width: 50,
          isFixed: 'right'
        },
      ],
    };
  }
}
