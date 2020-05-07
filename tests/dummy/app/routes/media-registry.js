import Route from '@ember/routing/route';
import fetch from 'fetch';

export default class MediaRegistryRoute extends Route {
  async model() {
    const res = await fetch('/data/full_catalog_bunny_records_table_1_sub_catalogs.json');
    const collection = await res.json();

    return {
      title: 'Master Recordings',
      type: 'master-collection',
      collection
    };
  }
}
