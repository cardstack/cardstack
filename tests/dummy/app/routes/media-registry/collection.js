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
      collection: tracks
    };
  }
}
