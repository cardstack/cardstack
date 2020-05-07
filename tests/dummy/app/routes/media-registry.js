import Route from '@ember/routing/route';
import fetch from 'fetch';

const MASTER_COLLECTIONS = '/media-registry/api/bunny_records_collections.json';

export default class MediaRegistryRoute extends Route {
  async model() {
    const res = await fetch(MASTER_COLLECTIONS);
    const collection = await res.json();

    return {
      title: 'Master Recordings',
      type: 'master-collection',
      collection
    };
  }
}
